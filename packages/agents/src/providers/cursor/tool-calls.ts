import type { AgentEvent, McpUse } from '../../runs/interfaces/event.interface';
import { asString, isRecord } from '../../shared/json';

/** `readToolCall` → `Read`, `shellToolCall` → `Shell`: the name shown in the terminal. */
export function cursorToolName(key: string): string {
  const base = key.replace(/ToolCall$/, '');
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}`;
}

/** The argument worth showing next to the tool name: a path, a command or a search pattern. */
function summarizeArgs(args: Record<string, unknown>): string {
  return (
    asString(args['path']) ??
    asString(args['command']) ??
    asString(args['pattern']) ??
    asString(args['globPattern']) ??
    ''
  );
}

/** Any call key that speaks of MCP: `getMcpToolsToolCall` (Cursor's tool catalog), `fetchMcpResourceToolCall`… */
const MCP_KEY = /mcp/i;

/**
 * How a Cursor call uses MCP, from its arguments: `mcpToolCall` calls `toolName` of `serverIdentifier` (or
 * `providerIdentifier`); any other MCP call (`getMcpToolsToolCall`, which lists the tools of `server`, Cursor's
 * own `cursor` catalog included) is a discovery. `undefined` for a call that is not about MCP.
 */
function cursorMcpUse(key: string, args: Record<string, unknown>): McpUse | undefined {
  const server = asString(args['serverIdentifier']) ?? asString(args['providerIdentifier']) ?? asString(args['server']);
  const tool = asString(args['toolName']);
  if (key === 'mcpToolCall' && server !== undefined && tool !== undefined) {
    return { kind: 'call', server, tool };
  }
  if (!MCP_KEY.test(key)) {
    return undefined;
  }
  return server === undefined ? { kind: 'discovery' } : { kind: 'discovery', server };
}

/**
 * The result of a finished call. Cursor names each outcome as a key of `result`: `success`, or a
 * refusal such as `permissionDenied` / `writePermissionDenied` (a deny rule matched) or `rejected`
 * (a command that needed approval nobody could give in a headless run), carrying `error`/`reason`.
 */
/** The fields a refusal or an error carries its message in (`readToolCall` uses `errorMessage`). */
const MESSAGE_FIELDS: readonly string[] = ['error', 'reason', 'message', 'errorMessage'];

/**
 * The first non-empty message of `detail` (itself, when it is text), looking inside an `error` that is an object
 * too; `''` when none.
 */
function messageOf(detail: unknown): string {
  if (!isRecord(detail)) {
    return asString(detail) ?? '';
  }
  for (const field of MESSAGE_FIELDS) {
    const value = detail[field];
    const text = isRecord(value) ? messageOf(value) : (asString(value) ?? '');
    if (text.trim() !== '') {
      return text;
    }
  }
  return '';
}

/**
 * Whether Cursor refused the call rather than the tool failing: `rejected` (a command no rule allows, which would
 * need an approval no one gives in a headless run), a `…PermissionDenied` outcome, or an `error` whose message is
 * a denial (`readToolCall` reports a denied path as `{ error: { errorMessage: 'Permission denied' } }`).
 */
function isDenied(kind: string, message: string): boolean {
  return kind === 'rejected' || /permissiondenied$/i.test(kind) || /^permission denied/i.test(message);
}

function toolResult(id: string, name: string, result: Record<string, unknown>): AgentEvent {
  const [kind = ''] = Object.keys(result);
  if (kind === 'success') {
    return { type: 'tool-result', id, name, isError: false, denied: false, text: '' };
  }
  const text = messageOf(result[kind]);
  return { type: 'tool-result', id, name, isError: true, denied: isDenied(kind, text), text };
}

/**
 * Turns a cursor-agent `{type:"tool_call"}` event into the same `tool-call` / `tool-result` events
 * the claude stream produces, so the terminal shows `→ Read: <path>` and denied calls for both
 * providers. `started` carries the arguments, `completed` the outcome, both under
 * `tool_call.<name>ToolCall`. The plan call (`createPlanToolCall`) is left to the plan handling.
 */
export function parseCursorToolCall(doc: Record<string, unknown>): readonly AgentEvent[] {
  const toolCall = doc['tool_call'];
  if (!isRecord(toolCall)) {
    return [];
  }
  const [key = ''] = Object.keys(toolCall);
  const body = toolCall[key];
  if (key === 'createPlanToolCall' || !isRecord(body)) {
    return [];
  }
  const id = asString(doc['call_id']) ?? '';
  const name = cursorToolName(key);
  const subtype = asString(doc['subtype']);
  if (subtype === 'started') {
    const args = isRecord(body['args']) ? body['args'] : {};
    const mcp = cursorMcpUse(key, args);
    return [{ type: 'tool-call', id, name, summary: summarizeArgs(args), ...(mcp === undefined ? {} : { mcp }) }];
  }
  if (subtype === 'completed' && isRecord(body['result'])) {
    return [toolResult(id, name, body['result'])];
  }
  return [];
}
