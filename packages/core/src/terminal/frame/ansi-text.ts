import type { TextPiece } from './interfaces/frame.interface';

/** The escape character that starts every terminal sequence. */
const ESC = String.fromCharCode(27);
/** A CSI escape sequence: colors and styles (`ESC[31m`), or anything else that moves no column. */
const ESCAPE = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
/** Turns every color and style off. */
const RESET = `${ESC}[0m`;

/** `text` as the terminal draws it: its characters (an accent with its letter is one) and its escape sequences. */
export function textPieces(text: string): readonly TextPiece[] {
  const pieces: TextPiece[] = [];
  let at = 0;
  for (const match of text.matchAll(ESCAPE)) {
    pushCharacters(pieces, text.slice(at, match.index));
    pieces.push({ text: match[0], width: 0 });
    at = match.index + match[0].length;
  }
  pushCharacters(pieces, text.slice(at));
  return pieces;
}

function pushCharacters(pieces: TextPiece[], text: string): void {
  for (const { segment } of GRAPHEMES.segment(text)) pieces.push({ text: segment, width: 1 });
}

/** How many columns `text` takes on the terminal, its escape sequences not counted. */
export function visibleWidth(text: string): number {
  return textPieces(text).reduce((sum, piece) => sum + piece.width, 0);
}

function widthOf(pieces: readonly TextPiece[]): number {
  return pieces.reduce((sum, piece) => sum + piece.width, 0);
}

/** Where the last space of `line` is, to break there; -1 when it has none. */
function lastSpace(line: readonly TextPiece[]): number {
  return line.findLastIndex((piece) => piece.text === ' ');
}

/**
 * `text` broken into lines of at most `width` columns: at the last space that fits, or in the middle of a word longer
 * than the line (a path with no space). The space a line breaks at is dropped.
 */
function breakPieces(text: string, width: number): readonly (readonly TextPiece[])[] {
  const lines: TextPiece[][] = [];
  let line: TextPiece[] = [];
  for (const piece of textPieces(text)) {
    if (piece.width === 1 && widthOf(line) === width) {
      const space = lastSpace(line);
      const breaksAtSpace = space >= 0 && piece.text !== ' ';
      lines.push(breaksAtSpace ? line.slice(0, space) : line);
      line = breaksAtSpace ? line.slice(space + 1) : [];
      if (piece.text === ' ') continue;
    }
    line.push(piece);
  }
  lines.push(line);
  return lines;
}

/** Whether an escape sequence turns every style off. */
function isReset(escape: string): boolean {
  return escape === RESET || escape === `${ESC}[m`;
}

/**
 * `text` wrapped to `width` columns (at least 1), keeping its colors: a style still on at the end of a line is turned
 * off there and on again at the start of the next, so nothing after the line (a border) is painted.
 */
export function wrapVisible(text: string, width: number): readonly string[] {
  let active: string[] = [];
  return breakPieces(text, Math.max(width, 1)).map((line) => {
    const opening = active.join('');
    for (const piece of line) {
      if (piece.width === 1) continue;
      active = isReset(piece.text) ? [] : [...active, piece.text];
    }
    const closing = active.length > 0 ? RESET : '';
    return `${opening}${line.map((piece) => piece.text).join('')}${closing}`;
  });
}
