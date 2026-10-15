import { ConfigError, type ConfigScalar, type ConfigTree, type ConfigValue } from '../common';

function isScalar(value: unknown): value is ConfigScalar {
  return (
    typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
  );
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function leaf(value: readonly unknown[], where: string): ConfigValue {
  if (!value.every(isScalar)) {
    throw new ConfigError(
      `${where}: uma lista só pode ter texto, número ou true/false, não outra lista nem um objeto.`,
    );
  }
  return value;
}

function node(value: unknown, where: string): ConfigTree | ConfigValue {
  if (isScalar(value)) return value;
  if (Array.isArray(value)) return leaf(value, where);
  if (isObject(value)) return branch(value, where);
  throw new ConfigError(`${where}: valor que a configuração não lê (use texto, número, true/false ou uma lista).`);
}

function branch(value: Readonly<Record<string, unknown>>, where: string): ConfigTree {
  const tree: Record<string, ConfigTree | ConfigValue> = {};
  for (const [name, child] of Object.entries(value)) {
    // A key with no value (`null` in JSON, nothing in YAML) is a key the file does not set.
    if (child === null || child === undefined) continue;
    tree[name] = node(child, `${where}.${name}`);
  }
  return tree;
}

/**
 * The tree of what a nested file parsed to (`unknown`), checked: objects at the nodes, and at the leaves text, numbers,
 * true/false or lists of those. Anything else is an error naming `file` and where in it.
 */
export function configTree(parsed: unknown, file: string): ConfigTree {
  if (parsed === null || parsed === undefined) return {};
  if (!isObject(parsed)) throw new ConfigError(`${file}: o arquivo tem que ser um objeto de chaves e valores.`);
  return branch(parsed, file);
}
