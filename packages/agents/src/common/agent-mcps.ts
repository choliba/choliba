import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import type { McpDeclaration } from './interfaces/agent.interface';
import { asString, isRecord } from './json';
import { expandVars } from './agent-vars';

/** One MCP server an agent declares, with its entry of an `mcpServers` map (`command`/`args`/`env` or `url`). */
export interface McpServer {
  readonly name: string;
  readonly config: Readonly<Record<string, unknown>>;
  /** Absolute path of the server's `<name>.json`. */
  readonly path: string;
  /** The only tools of the server the agent may call (`agent.yaml#mcps`); absent allows them all. */
  readonly tools?: readonly string[];
}

export class McpError extends Error {}

/** A server's JSON, which must say how to reach it: a `command` to start or a `url` to call. */
export function mcpConfig(text: string, source: string): Readonly<Record<string, unknown>> {
  let doc: unknown;
  try {
    doc = JSON.parse(text) as unknown;
  } catch (error) {
    throw new McpError(`${source}: JSON inválido (${String(error)}).`);
  }
  if (!isRecord(doc)) {
    throw new McpError(`${source}: esperado um objeto JSON.`);
  }
  if (asString(doc['command']) === undefined && asString(doc['url']) === undefined) {
    throw new McpError(`${source}: falta "command" ou "url".`);
  }
  return doc;
}

/** `value` with `${NAME}` replaced in every string inside it; the names with no value go to `missing`. */
function expandValue(value: unknown, vars: Readonly<Record<string, string>>, missing: Set<string>): unknown {
  if (typeof value === 'string') {
    const expanded = expandVars(value, vars);
    for (const name of expanded.missing) {
      missing.add(name);
    }
    return expanded.text;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => expandValue(item, vars, missing));
  }
  return isRecord(value) ? expandRecord(value, vars, missing) : value;
}

function expandRecord(
  record: Readonly<Record<string, unknown>>,
  vars: Readonly<Record<string, string>>,
  missing: Set<string>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, expandValue(item, vars, missing)]));
}

/**
 * A server's config with `${NAME}` filled in from `vars` (the repo config: `.env` and the
 * environment), so what differs per machine, like where the server is installed, stays out of the
 * versioned file. A variable with no value fails naming it; the available ones are not listed,
 * since the environment may hold secrets.
 */
export function expandMcpConfig(
  config: Readonly<Record<string, unknown>>,
  vars: Readonly<Record<string, string>>,
  source: string,
): Readonly<Record<string, unknown>> {
  const missing = new Set<string>();
  const expanded = expandRecord(config, vars, missing);
  if (missing.size > 0) {
    const names = [...missing].map((name) => `\${${name}}`).join(', ');
    throw new McpError(`${source} usa ${names}, sem valor: defina no .env ou no ambiente.`);
  }
  return expanded;
}

/** A server's `command` and `args`, as written (`raw`) and with the variables filled in (`expanded`), side by side. */
function serverPaths(
  raw: Readonly<Record<string, unknown>>,
  expanded: Readonly<Record<string, unknown>>,
): readonly { readonly raw: string; readonly path: string }[] {
  const strings = (config: Readonly<Record<string, unknown>>): string[] => {
    const args: unknown = config['args'];
    const list: readonly unknown[] = Array.isArray(args) ? (args as readonly unknown[]) : [];
    return [config['command'], ...list].map((item) => asString(item) ?? '');
  };
  const written = strings(raw);
  // Filling in the variables keeps the shape: the same item, written and expanded, sits at the same index.
  return strings(expanded).map((path, index) => ({ raw: String(written[index]), path }));
}

/**
 * Fails when a server that runs a `command` points at a file that is not there (an absolute `command` or argument,
 * like `${CHOL_MCP_APP_DIR}/dist/main.js` before the server is built): the provider would start the session
 * without it, and the agent would look for its tools in vain. When the path came from a variable, says which.
 */
function assertServerFiles(
  name: string,
  raw: Readonly<Record<string, unknown>>,
  expanded: Readonly<Record<string, unknown>>,
): void {
  const missing = serverPaths(raw, expanded).find(({ path }) => isAbsolute(path) && !existsSync(path));
  if (missing === undefined) return;
  const variable = /\$\{([A-Z0-9_]+)\}/.exec(missing.raw)?.[1];
  const hint = variable === undefined ? '' : ` (veja ${variable} no .env)`;
  throw new McpError(`o servidor do MCP ${name} não existe: ${missing.path}${hint}.`);
}

/**
 * Finds each MCP server an agent lists (`agent.yaml#mcps`) as `<mcpsDir>/<name>.json`, with its
 * `${NAME}` variables filled in from `vars`. A missing or malformed server, or a variable with no
 * value, fails the run up front, naming the file, instead of the agent silently running without it.
 */
export function resolveMcps(
  mcpsDir: string,
  declarations: readonly McpDeclaration[],
  vars: Readonly<Record<string, string>>,
): readonly McpServer[] {
  return declarations.map(({ name, tools }) => {
    const path = join(mcpsDir, `${name}.json`);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new McpError(`mcp "${name}" não encontrado: ${path} não existe.`);
    }
    const raw = mcpConfig(text, path);
    const config = expandMcpConfig(raw, vars, path);
    assertServerFiles(name, raw, config);
    return { name, config, path, ...(tools === undefined ? {} : { tools }) };
  });
}

/** The servers as an `mcpServers` map, the shape both `claude --mcp-config` and `.cursor/mcp.json` read. */
export function mcpServersMap(servers: readonly McpServer[]): Record<string, Readonly<Record<string, unknown>>> {
  return Object.fromEntries(servers.map((server) => [server.name, server.config]));
}
