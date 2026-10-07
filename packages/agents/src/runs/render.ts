import type { Theme } from '@choliba/core/theme';
import type { AnsiColor } from '@choliba/terminal';
import { formatLine } from '@choliba/terminal';

import type { AgentEvent } from './interfaces/event.interface';
import { failureLine } from './tool-failure';

export interface RenderOptions {
  readonly label: string;
  readonly colorize: boolean;
  readonly color?: AnsiColor;
}

/** First line printed when an agent run starts — identifies the resolved provider, each in its theme color. */
export function formatProviderLine(providerId: string, theme: Theme): string {
  return formatLine('provider', theme.paint('providers', providerId, providerId), {
    colorize: theme.enabled,
    color: theme.colorOf('labels', 'provider'),
  });
}

/** How an agent's lines are labeled: its name, in the color the theme gives it (its own `agent.color` second). */
export function agentRenderOptions(name: string, declared: AnsiColor | undefined, theme: Theme): RenderOptions {
  return { label: name, colorize: theme.enabled, color: theme.colorOf('agents', name, declared) };
}

/**
 * Not `text.split('\n')[0] ?? ''`: `noUncheckedIndexedAccess` would type that index as
 * possibly `undefined` even though `split` never returns an empty array, leaving a `??`
 * branch no input can ever take. `indexOf` sidesteps the indexing entirely.
 */
function firstLine(text: string): string {
  const newline = text.indexOf('\n');
  return newline === -1 ? text : text.slice(0, newline);
}

/**
 * Renders one normalized `AgentEvent` as a line of output, or `undefined` for an event that
 * produces nothing to print (a successful tool result, a quiet `done`). Deliberately does NOT
 * use `ProcessRunnerService`'s own `SessionLineEvent.formatted`: that field prefixes the *raw* line
 * from the child process, which for a provider in `--output-format stream-json` is one JSON
 * object per line — prefixing that with `[label]` would print JSON, not a conversation. Callers
 * (`run-agent.ts`) parse `event.raw` into `AgentEvent`s first and render those instead.
 */
export function renderEvent(event: AgentEvent, options: RenderOptions): string | undefined {
  const line = (text: string): string =>
    formatLine(options.label, text, {
      colorize: options.colorize,
      ...(options.color !== undefined ? { color: options.color } : {}),
    });

  switch (event.type) {
    case 'init':
      return line(`· ready${event.model === undefined ? '' : ` (${event.model})`}`);
    case 'text':
      return event.text === '' ? undefined : line(event.text);
    case 'tool-call':
      return line(`→ ${event.name}${event.summary === '' ? '' : `: ${event.summary}`}`);
    case 'tool-result':
      if (!event.isError) {
        return undefined;
      }
      return line(`✗ ${failureLine(event)}`);
    case 'plan':
      return line('· plan ready');
    case 'done':
      return event.isError ? line(`✗ ${firstLine(event.text)}`) : undefined;
  }
}
