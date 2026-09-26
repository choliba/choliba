import type { AgentEvent } from '../../events.types';
import { asString, isRecord } from '../../json';

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

/**
 * The result of a finished call. Cursor names each outcome as a key of `result`: `success`, or a
 * refusal such as `permissionDenied` / `writePermissionDenied` (a deny rule matched) or `rejected`
 * (a command that needed approval nobody could give in a headless run), carrying `error`/`reason`.
 */
function toolResult(id: string, name: string, result: Record<string, unknown>): AgentEvent {
  const [kind = ''] = Object.keys(result);
  if (kind === 'success') {
    return { type: 'tool-result', id, name, isError: false, denied: false, text: '' };
  }
  const detail = result[kind];
  const message = isRecord(detail) ? (asString(detail['error']) ?? asString(detail['reason'])) : undefined;
  // A `rejected` call comes with an empty reason; the outcome's own name is better than nothing.
  const text = message === undefined || message === '' ? kind : message;
  const denied = kind === 'rejected' || /permissiondenied$/i.test(kind);
  return { type: 'tool-result', id, name, isError: true, denied, text };
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
    return [{ type: 'tool-call', id, name, summary: summarizeArgs(args) }];
  }
  if (subtype === 'completed' && isRecord(body['result'])) {
    return [toolResult(id, name, body['result'])];
  }
  return [];
}
