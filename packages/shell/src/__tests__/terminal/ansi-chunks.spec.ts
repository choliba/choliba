import { ansiChunks } from '../../terminal/frame';

const ESC = '\u001b';

describe('ansiChunks', () => {
  it('gives plain text as one plain piece, and an empty line as none', () => {
    expect(ansiChunks('oi, tudo bem')).toEqual([{ text: 'oi, tudo bem', bold: false }]);
    expect(ansiChunks('')).toEqual([]);
  });

  it('paints each piece in the color and weight its codes set, until a reset', () => {
    const line = `${ESC}[36m[ola]${ESC}[0m ${ESC}[1mOi${ESC}[22m!`;
    expect(ansiChunks(line)).toEqual([
      { text: '[ola]', color: 'cyan', bold: false },
      { text: ' ', bold: false },
      { text: 'Oi', bold: true },
      { text: '!', bold: false },
    ]);
  });

  it('reads the bright colors, gray, the default color and a list of codes in one sequence', () => {
    expect(ansiChunks(`${ESC}[90mdica${ESC}[39m ${ESC}[1;91mfalhou${ESC}[m`)).toEqual([
      { text: 'dica', color: 'gray', bold: false },
      { text: ' ', bold: false },
      { text: 'falhou', color: 'bright-red', bold: true },
    ]);
  });

  it('keeps the style through a code it does not know and a sequence that is not a style', () => {
    expect(ansiChunks(`${ESC}[32mok ${ESC}[4mmais${ESC}[2K fim`)).toEqual([
      { text: 'ok ', color: 'green', bold: false },
      { text: 'mais', color: 'green', bold: false },
      { text: ' fim', color: 'green', bold: false },
    ]);
  });
});
