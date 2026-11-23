/** The agent's events: one producer for every agent, and the same records in the log. */

import { createProducer } from '../events/index';
import { redactToolDetail } from '../providers/tool-detail';
import { log, type LogInput } from '../logger/index';
import type { TokenUsage, ToolEvent } from '../providers/types';

/** Tools go to the log: calls and results in debug, failures as errors. */
export function logTool({ phase, detail }: ToolEvent): void {
  // Never the content: a provider with `toolOutput` hands it to the subscribers, not to the log.
  const kept = redactToolDetail(detail);
  if (phase === 'error') log.error({ type: 'tool_error', ...kept });
  else log.debug({ type: phase === 'call' ? 'tool' : 'tool_result', ...kept });
}

/** One request's tokens, as the agent emits and logs them. */
export function usageRecord(usage: TokenUsage, action?: string): LogInput {
  return {
    type: 'usage',
    input_tokens: usage.input,
    output_tokens: usage.output,
    ...(usage.cachedInput === undefined
      ? {}
      : { cached_input_tokens: usage.cachedInput }),
    ...(usage.cacheWrite === undefined
      ? {}
      : { cache_write_tokens: usage.cacheWrite }),
    ...(action === undefined ? {} : { action }),
    ...(usage.reasoning === undefined
      ? {}
      : { reasoning_tokens: usage.reasoning }),
  };
}

/** The producer of every agent's events; each event carries its `agent`. */
export const AGENT_SOURCE = 'agent';

export const agentEvents = createProducer(AGENT_SOURCE);

/** The conversation: for the subscribers and the log. */
export function publish(record: LogInput, level?: 'debug' | 'error'): void {
  agentEvents.emit(record);
  if (level === undefined) log.info(record);
  else log[level](record);
}
