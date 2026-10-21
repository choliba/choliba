import { BufferWritable } from '@choliba/kernel/testing';
import { formatElapsed, StatusFooter } from '../../terminal';

const ERASE_TWO = '\r\x1B[2A\x1B[0J';
const HIDE = '\x1B[?25l';
const SHOW = '\x1B[?25h';
const BEGIN = '\x1B[?2026h';
const END = '\x1B[?2026l';

function terminal(columns?: number): BufferWritable & { columns?: number } {
  const out: BufferWritable & { columns?: number } = new BufferWritable(true);
  if (columns !== undefined) out.columns = columns;
  return out;
}

describe('StatusFooter', () => {
  it('prints each line above the footer in one update: erases it, writes the line, draws it again', () => {
    const out = terminal(40);
    const footer = new StatusFooter(out, (width) => ['─'.repeat(3), `largura ${String(width)}`]);

    footer.draw();
    footer.writer(out).write('linha 1\n');

    expect(out.chunks).toEqual([
      `${BEGIN}${HIDE}───\nlargura 40\n${END}`,
      `${BEGIN}${ERASE_TWO}`,
      'linha 1\n',
      `───\nlargura 40\n${END}`,
    ]);
  });

  it('keeps the footer whole when the other stream of the terminal writes', () => {
    const out = terminal();
    const err = new BufferWritable(true);
    const footer = new StatusFooter(out, () => ['a', 'b']);

    footer.draw();
    footer.writer(err).write('aviso\n');

    expect(out.text()).toBe(`${BEGIN}${HIDE}a\nb\n${END}${BEGIN}${ERASE_TWO}a\nb\n${END}`);
    expect(err.text()).toBe('aviso\n');
  });

  it('draws in 80 columns when the terminal does not say, and hides nor erases anything it did not draw', () => {
    const out = terminal();
    const widths: number[] = [];
    const footer = new StatusFooter(out, (width) => {
      widths.push(width);
      return [];
    });

    footer.draw();
    footer.writer(out).write('x\n');
    footer.close();

    expect(widths).toEqual([80, 80]);
    expect(out.text()).toBe(`${BEGIN}${END}${BEGIN}x\n${END}`);
  });

  it('is erased for good by close, which shows the cursor again once', () => {
    const out = terminal();
    const footer = new StatusFooter(out, () => ['a', 'b']);

    footer.draw();
    footer.close();
    footer.close();

    expect(out.chunks).toEqual([`${BEGIN}${HIDE}a\nb\n${END}`, `${ERASE_TWO}${SHOW}`]);
  });
});

describe('formatElapsed', () => {
  it('says hours, minutes, seconds and milliseconds', () => {
    expect(formatElapsed(0)).toBe('00:00:00.000');
    expect(formatElapsed(102_317)).toBe('00:01:42.317');
    expect(formatElapsed(3_723_004.9)).toBe('01:02:03.004');
    expect(formatElapsed(-5)).toBe('00:00:00.000');
  });
});
