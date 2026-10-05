const RESET = '\u001b[0m';

const CODES = {
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  white: '\u001b[37m',
  gray: '\u001b[90m',
  'bright-red': '\u001b[91m',
  'bright-green': '\u001b[92m',
  'bright-yellow': '\u001b[93m',
  'bright-blue': '\u001b[94m',
  'bright-magenta': '\u001b[95m',
  'bright-cyan': '\u001b[96m',
} as const;

/**
 * The colors choliba paints with: the 16 colors every terminal has (each base color and its bright tone, plus
 * white and gray). `CHOL_COLORS` and `agent.yaml#agent.color` take only these names.
 */
export type AnsiColor = keyof typeof CODES;

export const ANSI_COLORS: readonly AnsiColor[] = [
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'gray',
  'bright-red',
  'bright-green',
  'bright-yellow',
  'bright-blue',
  'bright-magenta',
  'bright-cyan',
];

export function isAnsiColor(value: unknown): value is AnsiColor {
  return ANSI_COLORS.some((color) => color === value);
}

// Keyed by every value `hash % 6` can produce, so the lookup below is total: no
// `T | undefined` from `noUncheckedIndexedAccess`, and so no assertion is needed to
// narrow it back (this project's lint config forbids `!`, and flags `as` casts that
// only remove `undefined` in favor of `!`  — a plain array index can satisfy neither).
// Only the base tones: gray is the color of hints, and the bright ones are left for choices.
const PALETTE: Record<0 | 1 | 2 | 3 | 4 | 5, AnsiColor> = {
  0: 'red',
  1: 'green',
  2: 'yellow',
  3: 'blue',
  4: 'magenta',
  5: 'cyan',
};

/**
 * Deterministic label -> color so the same name always gets the same color, without any shared
 * mutable state: the color of a name nobody chose one for.
 */
export function colorForLabel(label: string): AnsiColor {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  const index = (hash % 6) as 0 | 1 | 2 | 3 | 4 | 5;
  return PALETTE[index];
}

/** `text` in `color`, reset right after. */
export function paintAnsi(color: AnsiColor, text: string): string {
  return `${CODES[color]}${text}${RESET}`;
}
