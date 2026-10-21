import { colorForLabel, paintAnsi, type AnsiColor } from '../theme';

export type { AnsiColor } from '../theme';
export { colorForLabel } from '../theme';

export interface FormatterOptions {
  readonly color?: AnsiColor;
  /**
   * `false` suppresses every ANSI code this package adds, for a run whose output is
   * being redirected to a file. Codes the child process emits are never touched.
   */
  readonly colorize?: boolean;
  /**
   * Rendered when present. `formatLine` deliberately never reads a clock: the caller
   * owns it, so the timestamp shown in the terminal and the one stored on the
   * `SessionLineEvent` are the same sample rather than two independent ones.
   */
  readonly timestamp?: Date;
}

/**
 * Prefixes `rawLine` with a `[label]` tag (colored unless `colorize` is false, and
 * optionally preceded by a timestamp), without touching any ANSI codes already
 * present in `rawLine` — tools like `go test` or `vite` keep their own colors intact.
 *
 * Pure: same arguments, same string. Known limitation: this formats one line at a
 * time, so an SGR color code a tool opens on one line and only resets several lines
 * later will not "bleed" across the label prefixes those later lines get. This is out
 * of scope for this step.
 */
export function formatLine(label: string, rawLine: string, options: FormatterOptions = {}): string {
  const tag = `[${label}]`;
  const prefix = options.colorize === false ? tag : paintAnsi(options.color ?? colorForLabel(label), tag);
  const timestamp = options.timestamp === undefined ? '' : `${options.timestamp.toISOString()} `;
  return `${prefix} ${timestamp}${rawLine}`;
}
