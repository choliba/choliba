import type { AnsiColor } from '../../theme';
import type { StyledChunk } from './interfaces/frame.interface';
import { textPieces } from './ansi-text';

/** The colors of the codes choliba paints with (`theme/ansi.ts`), by their SGR number. */
const COLORS: Readonly<Record<string, AnsiColor>> = {
  '31': 'red',
  '32': 'green',
  '33': 'yellow',
  '34': 'blue',
  '35': 'magenta',
  '36': 'cyan',
  '37': 'white',
  '90': 'gray',
  '91': 'bright-red',
  '92': 'bright-green',
  '93': 'bright-yellow',
  '94': 'bright-blue',
  '95': 'bright-magenta',
  '96': 'bright-cyan',
};

interface Style {
  readonly color: AnsiColor | undefined;
  readonly bold: boolean;
}

const PLAIN: Style = { color: undefined, bold: false };

/** The style after one SGR code: a reset, the weight, the default color or one of the 16 colors; any other is kept. */
function withCode(style: Style, code: string): Style {
  if (code === '' || code === '0') return PLAIN;
  if (code === '1') return { ...style, bold: true };
  if (code === '22') return { ...style, bold: false };
  if (code === '39') return { ...style, color: undefined };
  const color = COLORS[code];
  return color === undefined ? style : { ...style, color };
}

/** The style after an escape sequence: an SGR (`ESC[…m`) changes it; any other sequence moves no style. */
function afterEscape(style: Style, escape: string): Style {
  if (!escape.endsWith('m')) return style;
  return escape.slice(2, -1).split(';').reduce(withCode, style);
}

function chunk(text: string, style: Style): StyledChunk {
  return { text, ...(style.color === undefined ? {} : { color: style.color }), bold: style.bold };
}

/**
 * `line` as pieces of text, each with the color and weight the terminal would paint it in: what a screen that draws
 * its own text (the run panel) needs from a line choliba wrote with escape codes. Adjacent characters of one style are
 * one piece; a line with no text is no piece.
 */
export function ansiChunks(line: string): readonly StyledChunk[] {
  const chunks: StyledChunk[] = [];
  let style = PLAIN;
  let text = '';
  for (const piece of textPieces(line)) {
    if (piece.width === 1) {
      text += piece.text;
      continue;
    }
    if (text !== '') chunks.push(chunk(text, style));
    text = '';
    style = afterEscape(style, piece.text);
  }
  if (text !== '') chunks.push(chunk(text, style));
  return chunks;
}
