/** One piece of a line as the terminal draws it: a character (one column) or an escape sequence (none). */
export interface TextPiece {
  readonly text: string;
  readonly width: 0 | 1;
}
