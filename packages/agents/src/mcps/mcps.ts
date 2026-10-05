import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McpDeclaration } from '../agents/interfaces/agent.interface';
import { asString, isRecord } from '../shared/json';
import { expandVars } from '../runs/vars';

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
    const config = expandMcpConfig(mcpConfig(text, path), vars, path);
    return { name, config, path, ...(tools === undefined ? {} : { tools }) };
  });
}

/** The servers as an `mcpServers` map, the shape both `claude --mcp-config` and `.cursor/mcp.json` read. */
export function mcpServersMap(servers: readonly McpServer[]): Record<string, Readonly<Record<string, unknown>>> {
  return Object.fromEntries(servers.map((server) => [server.name, server.config]));
}
