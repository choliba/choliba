import { CONFIG_KEYS, type ConfigKey } from './config-keys';

/**
 * A value as the `.env` keeps it: in quotes when a space, a `#` or a quote would otherwise change it, the ones it does
 * not contain (`parseConfigFile` takes the quotes off and no escape inside them); `configValueError` refuses one with both.
 */
function quoted(value: string): string {
  if (!/[\s#"']/.test(value)) return value;
  return value.includes('"') ? `'${value}'` : `"${value}"`;
}

/**
 * The `.env` `content` with `key` set to `value`, the rest as it was: the line that sets it gets the new value; else
 * the template's commented line (`# KEY=…`) becomes it, where its explanation is; else it goes at the end.
 */
export function withEnvValue(content: string, key: string, value: string): string {
  const line = `${key}=${quoted(value)}`;
  const lines = content.split('\n');
  const set = lines.findIndex((current) => current.trim().startsWith(`${key}=`));
  const commented = lines.findIndex((current) => new RegExp(`^#\\s*${key}=`).test(current.trim()));
  const at = set === -1 ? commented : set;
  if (at !== -1) return lines.map((current, index) => (index === at ? line : current)).join('\n');
  const body = content.endsWith('\n') || content === '' ? content : `${content}\n`;
  return `${body}${line}\n`;
}

/** The key of the registry called `name`. */
export function findConfigKey(name: string): ConfigKey | undefined {
  return CONFIG_KEYS.find((key) => key.name === name);
}

/** Why `value` cannot be `name`'s, in pt-BR: a key the registry does not know, or a value out of its list. */
export function configValueError(name: string, value: string): string | undefined {
  const key = findConfigKey(name);
  if (key === undefined) {
    return `Chave desconhecida: ${name}. As chaves são ${CONFIG_KEYS.map(({ name: known }) => known).join(', ')}.`;
  }
  if (value.includes('\n') || (value.includes('"') && value.includes("'"))) {
    return `Valor inválido para ${name}: o .env não guarda numa linha um valor com quebra de linha ou com os dois tipos de aspas.`;
  }
  if (key.values !== undefined && !key.values.includes(value)) {
    return `Valor inválido para ${name}: ${value}. Use ${key.values.join(', ')}.`;
  }
  return undefined;
}
