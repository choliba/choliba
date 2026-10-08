import type { McpUse } from './interfaces/event.interface';

const CLAUDE_MCP_PREFIX = 'mcp__';

/** Claude Code's own tools that list or read the resources of an MCP server. */
const CLAUDE_MCP_DISCOVERY: readonly string[] = ['ListMcpResourcesTool', 'ReadMcpResourceTool'];

/**
 * How a Claude Code tool call uses MCP: `mcp__<server>__<tool>` calls one tool of a server; the resource tools
 * list or read a server's resources (`server`, when the call names one). `undefined` for any other tool.
 */
export function claudeMcpUse(name: string, server: string | undefined): McpUse | undefined {
  if (name.startsWith(CLAUDE_MCP_PREFIX)) {
    const rest = name.slice(CLAUDE_MCP_PREFIX.length);
    const separator = rest.indexOf('__');
    return separator === -1
      ? { kind: 'discovery', server: rest }
      : { kind: 'call', server: rest.slice(0, separator), tool: rest.slice(separator + 2) };
  }
  if (!CLAUDE_MCP_DISCOVERY.includes(name)) {
    return undefined;
  }
  return server === undefined ? { kind: 'discovery' } : { kind: 'discovery', server };
}
