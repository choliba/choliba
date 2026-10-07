import type { AgentEvent } from './interfaces/event.interface';

type ToolResult = Extract<AgentEvent, { type: 'tool-result' }>;

/** What a denied tool does and the `agent.yaml` key that would allow it. */
interface Permission {
  readonly what: string;
  readonly key: string;
}

const READ: Permission = { what: 'leitura', key: 'allow.read' };
const WRITE: Permission = { what: 'escrita', key: 'allow.write' };
const COMMAND: Permission = { what: 'comando', key: 'allow.execute' };
const MCP: Permission = { what: 'MCP', key: 'mcps' };

/** Each provider's tools by what they do, so a denial says the same thing whatever the provider. */
const PERMISSIONS: Readonly<Record<string, Permission>> = {
  Read: READ,
  Grep: READ,
  Glob: READ,
  LS: READ,
  Write: WRITE,
  Edit: WRITE,
  MultiEdit: WRITE,
  NotebookEdit: WRITE,
  Delete: WRITE,
  Bash: COMMAND,
  Shell: COMMAND,
};

function firstLine(text: string): string {
  const newline = text.indexOf('\n');
  return (newline === -1 ? text : text.slice(0, newline)).trim();
}

/** What the call worked on: the server and tool of an MCP call, else its path or command. */
function targetOf(event: ToolResult): string {
  if (event.mcp?.kind === 'call') return `${event.mcp.server}:${event.mcp.tool}`;
  return event.target ?? '';
}

function deniedReason(event: ToolResult): string {
  const permission = event.mcp === undefined ? PERMISSIONS[event.name ?? ''] : MCP;
  return permission === undefined
    ? 'negado (pelas permissões do agent.yaml)'
    : `negado (${permission.what} fora de ${permission.key})`;
}

function errorReason(event: ToolResult): string {
  const message = firstLine(event.text);
  return message === '' ? 'erro (o provider não disse o motivo)' : `erro: ${message}`;
}

/**
 * A failed tool call in words, the same for every provider: the tool, what it worked on, and why — denied by
 * the permissions (naming the `agent.yaml` key that would allow it, never the provider's own wording) or the
 * tool's own error. `✗ Shell bun install: negado (comando fora de allow.execute)`.
 */
export function failureLine(event: ToolResult): string {
  const target = targetOf(event);
  const tool = `${event.name ?? '?'}${target === '' ? '' : ` ${target}`}`;
  return `${tool}: ${event.denied ? deniedReason(event) : errorReason(event)}`;
}
