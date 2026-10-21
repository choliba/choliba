import type { AnsiColor } from '../../../theme';

/** One piece of a line as the terminal draws it: a character (one column) or an escape sequence (none). */
export interface TextPiece {
  readonly text: string;
  readonly width: 0 | 1;
}

/** A run of text in one style, for a screen that paints its own text: one of choliba's colors, and the weight. */
export interface StyledChunk {
  readonly text: string;
  readonly color?: AnsiColor;
  readonly bold: boolean;
}
