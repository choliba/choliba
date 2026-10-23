import { contentBlocks, summarize, toolResultText, type AgentEvent, type StreamParser } from '@choliba/engine';

import { parseCursorToolCall } from './cursor-tool-calls';
import { asBoolean, asString, isRecord, parseJsonLine } from './json';
import { claudeMcpUse } from './mcp-use';

export interface StreamJsonParserOptions {
  readonly planFromExitPlanMode: boolean;
  /** cursor-agent `--mode plan`: plan markdown lives in `createPlanToolCall`, not `result`. */
  readonly planFromCreatePlanToolCall?: boolean;
  /** cursor-agent: tool calls arrive as `{type:tool_call}` events, not as `assistant` tool_use blocks. */
  readonly toolCallEvents?: boolean;
}

export interface StreamJsonParser extends StreamParser {
  readonly sawInitWithModel: boolean;
}

function readModel(doc: Record<string, unknown>): string | undefined {
  return asString(doc['model']) ?? asString(doc['model_id']);
}

function readSessionId(doc: Record<string, unknown>): string | undefined {
  return asString(doc['session_id']) ?? asString(doc['sessionId']);
}

/** Normalizes claude `{type:system,subtype:init}` and cursor `{type:init}` into one `init` event. */
export function parseInitEvent(doc: Record<string, unknown>): Extract<AgentEvent, { type: 'init' }> | undefined {
  const type = asString(doc['type']);
  const isClaudeInit = type === 'system' && asString(doc['subtype']) === 'init';
  const isFlatInit = type === 'init';
  if (!isClaudeInit && !isFlatInit) {
    return undefined;
  }
  return { type: 'init', model: readModel(doc), sessionId: readSessionId(doc) };
}

/** Reads plan markdown from cursor-agent `{type:tool_call, tool_call.createPlanToolCall}`. */
export function extractCreatePlanToolPlan(doc: Record<string, unknown>): string | undefined {
  const toolCall = doc['tool_call'];
  if (!isRecord(toolCall)) {
    return undefined;
  }
  const createPlan = toolCall['createPlanToolCall'];
  if (!isRecord(createPlan)) {
    return undefined;
  }
  const args = createPlan['args'];
  if (!isRecord(args)) {
    return undefined;
  }
  return asString(args['plan']);
}

type ToolCall = Extract<AgentEvent, { type: 'tool-call' }>;

/**
 * Gives each tool result the target and MCP of its call, remembered by id: a result line says only the outcome
 * (Cursor's `completed` does not repeat the arguments), and a failure is read with what it failed on.
 */
function withCallDetails(events: readonly AgentEvent[], calls: Map<string, ToolCall>): readonly AgentEvent[] {
  return events.map((event) => {
    if (event.type === 'tool-call') {
      calls.set(event.id, event);
      return event;
    }
    const call = event.type === 'tool-result' ? calls.get(event.id) : undefined;
    if (event.type !== 'tool-result' || call === undefined) {
      return event;
    }
    return {
      ...event,
      ...(call.summary === '' ? {} : { target: call.summary }),
      ...(call.mcp === undefined ? {} : { mcp: call.mcp }),
    };
  });
}

/**
 * The texts of a denied call in Claude Code's non-interactive mode: a rule refused it ("Permission to use … has
 * been denied"), or nothing allowed it and no one could ("… requested permissions to use …, but you haven't
 * granted it yet").
 */
const CLAUDE_DENIED = /^Permission to use|requested permissions to use/;

export function createStreamJsonParser(options: StreamJsonParserOptions): StreamJsonParser {
  const toolNames = new Map<string, string>();
  const calls = new Map<string, ToolCall>();
  let sawInitWithModel = false;

  return {
    get sawInitWithModel() {
      return sawInitWithModel;
    },
    parseLine(line: string): readonly AgentEvent[] {
      return withCallDetails(parseEvents(line), calls);
    },
  };

  function parseEvents(line: string): readonly AgentEvent[] {
    const parsed = parseJsonLine(line);
    if (!isRecord(parsed)) {
      return [];
    }

    const init = parseInitEvent(parsed);
    if (init !== undefined) {
      if (init.model !== undefined) {
        sawInitWithModel = true;
      }
      return [init];
    }

    const type = asString(parsed['type']);

    if (type === 'assistant') {
      const events: AgentEvent[] = [];
      for (const block of contentBlocks(parsed['message'])) {
        if (block.type === 'text' && block.text !== undefined) {
          events.push({ type: 'text', text: block.text });
          continue;
        }
        if (block.type === 'tool_use' && block.id !== undefined) {
          const name = block.name ?? '?';
          toolNames.set(block.id, name);
          const mcp = claudeMcpUse(name, block.input?.server);
          events.push({
            type: 'tool-call',
            id: block.id,
            name,
            summary: summarize(block.input),
            ...(mcp === undefined ? {} : { mcp }),
          });
          if (options.planFromExitPlanMode && name === 'ExitPlanMode' && block.input?.plan !== undefined) {
            events.push({ type: 'plan', markdown: block.input.plan });
          }
        }
      }
      return events;
    }

    if (type === 'user') {
      const events: AgentEvent[] = [];
      for (const block of contentBlocks(parsed['message'])) {
        if (block.type === 'tool_result' && block.tool_use_id !== undefined) {
          const isError = asBoolean(block.is_error) ?? false;
          const text = toolResultText(block);
          events.push({
            type: 'tool-result',
            id: block.tool_use_id,
            name: toolNames.get(block.tool_use_id),
            isError,
            denied: isError && CLAUDE_DENIED.test(text),
            text,
          });
        }
      }
      return events;
    }

    if (type === 'result') {
      return [
        { type: 'done', isError: asBoolean(parsed['is_error']) ?? false, text: asString(parsed['result']) ?? '' },
      ];
    }

    if (type === 'tool_call') {
      const events: AgentEvent[] = options.toolCallEvents === true ? [...parseCursorToolCall(parsed)] : [];
      // The plan call arrives twice (started, then completed, both with the plan); one is enough.
      const plan =
        options.planFromCreatePlanToolCall === true && asString(parsed['subtype']) !== 'completed'
          ? extractCreatePlanToolPlan(parsed)
          : undefined;
      if (plan !== undefined) {
        events.push({ type: 'plan', markdown: plan });
      }
      return events;
    }

    return [];
  }
}
