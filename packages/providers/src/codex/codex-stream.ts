import type { AgentEvent, McpUse, StreamParser } from '@choliba/engine';

import { asString, isRecord, parseJsonLine } from '../common';

type ToolCall = Extract<AgentEvent, { type: 'tool-call' }>;

function itemOf(doc: Record<string, unknown>): Record<string, unknown> | undefined {
  const item = doc['item'];
  return isRecord(item) ? item : undefined;
}

function itemId(item: Record<string, unknown>): string {
  return asString(item['id']) ?? '?';
}

function commandCall(item: Record<string, unknown>): ToolCall {
  return {
    type: 'tool-call',
    id: itemId(item),
    name: 'Bash',
    summary: asString(item['command']) ?? '',
  };
}

function pathsOf(item: Record<string, unknown>): readonly string[] {
  const changes = item['changes'];
  if (!Array.isArray(changes)) return [];
  return changes.flatMap((change: unknown) => {
    if (!isRecord(change)) return [];
    const path = asString(change['path']);
    return path === undefined ? [] : [path];
  });
}

function fileCall(item: Record<string, unknown>): ToolCall {
  return { type: 'tool-call', id: itemId(item), name: 'Edit', summary: pathsOf(item).join(', ') };
}

function mcpUse(item: Record<string, unknown>): Extract<McpUse, { kind: 'call' }> | undefined {
  const server = asString(item['server']);
  const tool = asString(item['tool']);
  if (server === undefined || tool === undefined) return undefined;
  return { kind: 'call', server, tool };
}

function mcpCall(item: Record<string, unknown>): ToolCall {
  const use = mcpUse(item);
  const name = use === undefined ? 'MCP' : `mcp__${use.server}__${use.tool}`;
  const summary = item['arguments'] === undefined ? '' : JSON.stringify(item['arguments']);
  return { type: 'tool-call', id: itemId(item), name, summary, ...(use === undefined ? {} : { mcp: use }) };
}

function toolCall(item: Record<string, unknown>): ToolCall | undefined {
  const type = asString(item['type']);
  if (type === 'command_execution') return commandCall(item);
  if (type === 'file_change') return fileCall(item);
  if (type === 'mcp_tool_call') return mcpCall(item);
  return undefined;
}

function denied(text: string): boolean {
  return /permission denied|not permitted|sandbox|approval/i.test(text);
}

function resultText(item: Record<string, unknown>): string {
  return asString(item['aggregated_output']) ?? asString(item['error']) ?? asString(item['result']) ?? '';
}

function toolResult(item: Record<string, unknown>, call: ToolCall): AgentEvent {
  const text = resultText(item);
  const status = asString(item['status']);
  const exitCode = item['exit_code'];
  const isError =
    status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0) || item['error'] !== undefined;
  return {
    type: 'tool-result',
    id: call.id,
    name: call.name,
    isError,
    denied: isError && denied(text),
    text,
    ...(call.summary === '' ? {} : { target: call.summary }),
    ...(call.mcp === undefined ? {} : { mcp: call.mcp }),
  };
}

function completedItem(item: Record<string, unknown>, calls: Map<string, ToolCall>): readonly AgentEvent[] {
  const type = asString(item['type']);
  if (type === 'agent_message') {
    const text = asString(item['text']);
    return text === undefined ? [] : [{ type: 'text', text }];
  }
  const call = calls.get(itemId(item)) ?? toolCall(item);
  return call === undefined ? [] : [toolResult(item, call)];
}

/** Normalizes `codex exec --json` JSONL into the provider-independent event contract. */
export function createCodexStreamParser(): StreamParser {
  const calls = new Map<string, ToolCall>();
  return {
    sawInitWithModel: false,
    parseLine(line: string): readonly AgentEvent[] {
      const parsed = parseJsonLine(line);
      if (!isRecord(parsed)) return [];
      const type = asString(parsed['type']);
      if (type === 'thread.started') {
        return [{ type: 'init', model: undefined, sessionId: asString(parsed['thread_id']) }];
      }
      if (type === 'item.started') {
        const item = itemOf(parsed);
        if (item === undefined) return [];
        const call = toolCall(item);
        if (call === undefined) return [];
        calls.set(call.id, call);
        return [call];
      }
      if (type === 'item.completed') {
        const item = itemOf(parsed);
        return item === undefined ? [] : completedItem(item, calls);
      }
      if (type === 'turn.completed') return [{ type: 'done', isError: false, text: '' }];
      if (type === 'turn.failed') {
        const error = parsed['error'];
        const text = isRecord(error) ? (asString(error['message']) ?? '') : '';
        return [{ type: 'done', isError: true, text }];
      }
      return [];
    },
  };
}
