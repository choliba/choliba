import { asString, isRecord } from '../common';
import { expandVars } from './agent-vars';

export interface McpServer {
  readonly name: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly path: string;
  readonly tools?: readonly string[];
}

export class McpError extends Error {}

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

export function mcpServersMap(servers: readonly McpServer[]): Record<string, Readonly<Record<string, unknown>>> {
  return Object.fromEntries(servers.map((server) => [server.name, server.config]));
}
