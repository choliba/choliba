import type { AgentEvent } from '../runs/interfaces/event.interface';
import { asBoolean, asString, isRecord, parseJsonLine } from '../shared/json';
import { contentBlocks, summarize, toolResultText } from './message-blocks';
import { parseCursorToolCall } from './cursor/tool-calls';
import type { StreamParser } from './interfaces/provider.interface';

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

export function validateExplicitModel(
  model: string,
  supportedModels: readonly string[],
  agentName: string,
): string | undefined {
  if (supportedModels.length === 0 || supportedModels.includes(model)) {
    return undefined;
  }
  return (
    `Model "${model}" is not declared in agent.yaml#supported_models for "${agentName}". ` +
    `Supported: ${supportedModels.join(', ')}.`
  );
}

export interface ReportedModelContext {
  readonly providerId: string;
  readonly agentName: string;
}

export function validateReportedModel(
  model: string,
  supportedModels: readonly string[],
  ctx: ReportedModelContext,
): string | undefined {
  if (supportedModels.length === 0 || supportedModels.includes(model)) {
    return undefined;
  }
  return (
    `${ctx.providerId} is using model "${model}", not declared in agent.yaml#supported_models ` +
    `for "${ctx.agentName}". Supported: ${supportedModels.join(', ')}. Stopping.`
  );
}

export function modelReportMissingMessage(supportedModels: readonly string[], ctx: ReportedModelContext): string {
  return (
    `${ctx.providerId} did not report a model before starting work for "${ctx.agentName}" ` +
    `(agent.yaml#supported_models requires one of: ${supportedModels.join(', ')}). ` +
    'Pass --model explicitly or fix the provider stream parser. Stopping.'
  );
}

export function validateModelReportMissing(
  supportedModels: readonly string[],
  ctx: ReportedModelContext,
): string | undefined {
  if (supportedModels.length === 0) {
    return undefined;
  }
  return modelReportMissingMessage(supportedModels, ctx);
}

export function isSubstantiveAgentEvent(event: AgentEvent): boolean {
  return event.type === 'text' || event.type === 'tool-call';
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

export function defaultResolvePlanContent(context: {
  readonly planMarkdown: string | undefined;
  readonly doneEvent: Extract<AgentEvent, { type: 'done' }> | undefined;
  readonly textParts: readonly string[];
}): string | undefined {
  return firstNonEmpty(context.planMarkdown, context.doneEvent?.text, context.textParts.join('\n\n'));
}

function firstNonEmpty(...candidates: readonly (string | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate.trim() !== '') {
      return candidate;
    }
  }
  return undefined;
}

export function createStreamJsonParser(options: StreamJsonParserOptions): StreamJsonParser {
  const toolNames = new Map<string, string>();
  let sawInitWithModel = false;

  return {
    get sawInitWithModel() {
      return sawInitWithModel;
    },
    parseLine(line: string): readonly AgentEvent[] {
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
            events.push({ type: 'tool-call', id: block.id, name, summary: summarize(block.input) });
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
              denied: isError && text.startsWith('Permission to use'),
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
    },
  };
}
