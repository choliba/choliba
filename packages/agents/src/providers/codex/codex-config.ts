import { isRecord } from '../../common';
import type { McpServer } from '../../common';

export class CodexConfigError extends Error {}

function keyPart(value: string): string {
  return JSON.stringify(value);
}

function scalar(value: unknown, path: string): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map((item) => scalar(item, path)).join(', ')}]`;
  throw new CodexConfigError(`configuração MCP não suportada em ${path}`);
}

function overrides(value: unknown, path: readonly string[]): readonly string[] {
  const name = path.map(keyPart).join('.');
  if (!isRecord(value)) return [`${name}=${scalar(value, name)}`];
  return Object.entries(value).flatMap(([key, item]) => overrides(item, [...path, key]));
}

/** Codex `-c` overrides for exactly the MCP servers declared by the agent. */
export function codexMcpArgs(servers: readonly McpServer[]): readonly string[] {
  return servers.flatMap((server) => {
    const config = {
      ...server.config,
      ...(server.tools === undefined ? {} : { enabled_tools: server.tools }),
    };
    return overrides(config, ['mcp_servers', server.name]).flatMap((override) => ['-c', override]);
  });
}
