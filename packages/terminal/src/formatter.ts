const ANSI_RESET = '\u001b[0m';

const ANSI_COLORS = {
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
} as const;

export type AnsiColor = keyof typeof ANSI_COLORS;

// Keyed by every value `hash % 6` can produce, so the lookup below is total: no
// `T | undefined` from `noUncheckedIndexedAccess`, and so no assertion is needed to
// narrow it back (this project's lint config forbids `!`, and flags `as` casts that
// only remove `undefined` in favor of `!`  — a plain array index can satisfy neither).
const PALETTE: Record<0 | 1 | 2 | 3 | 4 | 5, AnsiColor> = {
  0: 'red',
  1: 'green',
  2: 'yellow',
  3: 'blue',
  4: 'magenta',
  5: 'cyan',
};

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
 * Deterministic label -> color so the same session always gets the same color,
 * without any shared mutable state between sessions.
 */
export function colorForLabel(label: string): AnsiColor {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  const index = (hash % 6) as 0 | 1 | 2 | 3 | 4 | 5;
  return PALETTE[index];
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
  const prefix =
    options.colorize === false ? tag : `${ANSI_COLORS[options.color ?? colorForLabel(label)]}${tag}${ANSI_RESET}`;
  const timestamp = options.timestamp === undefined ? '' : `${options.timestamp.toISOString()} `;
  return `${prefix} ${timestamp}${rawLine}`;
}
