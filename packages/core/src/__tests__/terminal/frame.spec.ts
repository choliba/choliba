import { frameBottom, frameLines, frameTop, textPieces, visibleWidth, wrapVisible } from '../../terminal';

const RED = '\x1B[31m';
const RESET = '\x1B[0m';

describe('visibleWidth / textPieces', () => {
  it('counts the columns the terminal draws: no escape sequence, an accented letter as one', () => {
    expect(visibleWidth(`${RED}✗ falhou${RESET}`)).toBe(8);
    expect(visibleWidth('é')).toBe(1);
    expect(textPieces(`a${RED}b`)).toEqual([
      { text: 'a', width: 1 },
      { text: RED, width: 0 },
      { text: 'b', width: 1 },
    ]);
  });
});

describe('wrapVisible', () => {
  it('breaks at the last space that fits, dropping it', () => {
    expect(wrapVisible('Vou ler o ticket ferramenta-1 agora', 16)).toEqual([
      'Vou ler o ticket',
      'ferramenta-1',
      'agora',
    ]);
  });

  it('breaks a word longer than the line in the middle, so no line is wider', () => {
    expect(wrapVisible('→ Read: /home/voce/dev/global/projects/ferramenta/tickets/1.json', 20)).toEqual([
      '→ Read:',
      '/home/voce/dev/globa',
      'l/projects/ferrament',
      'a/tickets/1.json',
    ]);
  });

  it('keeps a color across the break: off at the end of a line, on again at the start of the next', () => {
    expect(wrapVisible(`${RED}aaaa bbbb${RESET} c`, 4)).toEqual([`${RED}aaaa${RESET}`, `${RED}bbbb${RESET}`, 'c']);
  });

  it('keeps a short line, an empty one, and works with a width below one', () => {
    expect(wrapVisible('curta', 20)).toEqual(['curta']);
    expect(wrapVisible('', 20)).toEqual(['']);
    expect(wrapVisible('ab', 0)).toEqual(['a', 'b']);
    expect(wrapVisible(`${RED}x\x1B[my`, 1)).toEqual([`${RED}x\x1B[m`, 'y']);
  });
});

describe('frameLines', () => {
  it('frames each line between borders that line up, wrapping the long ones inside', () => {
    expect(frameLines('olá\nVou ler o ticket ferramenta-1\n', 20)).toEqual([
      '│ olá              │',
      '│ Vou ler o ticket │',
      '│ ferramenta-1     │',
    ]);
  });

  it('lines the right border up after a colored line', () => {
    const [line] = frameLines(`${RED}✗ erro${RESET}`, 12);

    expect(line).toBe(`│ ${RED}✗ erro${RESET}   │`);
    expect(visibleWidth(line ?? '')).toBe(12);
  });

  it('keeps only what the terminal would show of a line: the last part after a carriage return, no control characters', () => {
    expect(frameLines('10%\r100%\tok\u0007', 14)).toEqual(['│ 100%  ok   │']);
  });

  it('keeps at least one column inside a frame narrower than its borders', () => {
    expect(frameLines('ab', 3)).toEqual(['│ a │', '│ b │']);
  });
});

describe('frameTop / frameBottom', () => {
  it('puts the title in the top border, painted, and closes the frame at the bottom', () => {
    expect(frameTop('product-owner', 24, (text) => `${RED}${text}${RESET}`)).toBe(
      `┌─ ${RED}product-owner${RESET} ──────┐`,
    );
    expect(frameTop('product-owner', 24)).toHaveLength(24);
    expect(frameBottom(10)).toBe('└────────┘');
  });

  it('cuts a title that does not fit, and stays whole-bordered when too narrow', () => {
    expect(frameTop('product-owner', 12)).toBe('┌─ produ… ─┐');
    expect(frameTop('x', 4)).toBe('┌─  ┐');
    expect(frameBottom(1)).toBe('└┘');
  });
});
