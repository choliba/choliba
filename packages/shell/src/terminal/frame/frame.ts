import { textPieces, visibleWidth, wrapVisible } from './ansi-text';

const HORIZONTAL = '─';
/** The border and the space on each side of a framed line: `│ ` and ` │`. */
const SIDES = 4;

/** The escape character, the one control character a framed line keeps (it starts the colors). */
const ESC = 27;

/**
 * `line` as the terminal would leave it, without the control characters that would move the cursor inside the frame:
 * after a carriage return only what comes last stays (a progress line redrawn in place), a tab becomes two spaces, and
 * any other control character but the escape is dropped.
 */
function printable(line: string): string {
  const last = line.slice(line.lastIndexOf('\r') + 1).replaceAll('\t', '  ');
  return Array.from(last)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === ESC || (code >= 32 && code !== 127);
    })
    .join('');
}

/** The width inside a frame of `width` columns, never less than one column. */
function innerWidth(width: number): number {
  return Math.max(width - SIDES, 1);
}

/** `text` cut to `width` visible columns, with `…` when it did not fit (titles have no color of their own). */
function cut(text: string, width: number): string {
  const characters = textPieces(text).map((piece) => piece.text);
  if (characters.length <= width) return text;
  if (width <= 0) return '';
  return `${characters.slice(0, width - 1).join('')}…`;
}

/**
 * The top of a frame of `width` columns with `title` in it (`┌─ product-owner ────┐`), the title cut to fit and then
 * passed to `paint` (its color).
 */
export function frameTop(title: string, width: number, paint: (text: string) => string = (text) => text): string {
  const room = Math.max(width - 6, 0);
  const shown = cut(title, room);
  const rest = Math.max(width - 5 - visibleWidth(shown), 0);
  return `┌─ ${paint(shown)} ${HORIZONTAL.repeat(rest)}┐`;
}

/** The bottom of a frame of `width` columns: `└────┘`. */
export function frameBottom(width: number): string {
  return `└${HORIZONTAL.repeat(Math.max(width - 2, 0))}┘`;
}

/**
 * The lines of `text` inside a frame of `width` columns: each one wrapped to the inside (at a space, or in the middle
 * of a word longer than the line), padded, between `│ ` and ` │`, so the right border lines up and no line is wider
 * than the terminal. A trailing newline ends the text, it does not add an empty line.
 */
export function frameLines(text: string, width: number): readonly string[] {
  const inner = innerWidth(width);
  const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
  return lines
    .flatMap((line) => wrapVisible(printable(line), inner))
    .map((line) => `│ ${line}${' '.repeat(Math.max(inner - visibleWidth(line), 0))} │`);
}
