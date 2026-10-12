import { BufferWritable } from '../../testing';
import { formatElapsed, StatusFooter } from '../../terminal';

const ERASE_TWO = '\x1B[2A\x1B[0J';

function terminal(columns?: number): BufferWritable & { columns?: number } {
  const out: BufferWritable & { columns?: number } = new BufferWritable(true);
  if (columns !== undefined) out.columns = columns;
  return out;
}

describe('StatusFooter', () => {
  it('prints each line above the footer: erases it, writes the line, draws it again', () => {
    const out = terminal(40);
    const footer = new StatusFooter(out, (width) => ['─'.repeat(3), `largura ${String(width)}`]);

    footer.draw();
    footer.writer(out).write('linha 1\n');

    expect(out.chunks).toEqual(['───\nlargura 40\n', ERASE_TWO, 'linha 1\n', '───\nlargura 40\n']);
  });

  it('keeps the footer whole when the other stream of the terminal writes', () => {
    const out = terminal();
    const err = new BufferWritable(true);
    const footer = new StatusFooter(out, () => ['a', 'b']);

    footer.draw();
    footer.writer(err).write('aviso\n');

    expect(out.chunks).toEqual(['a\nb\n', ERASE_TWO, 'a\nb\n']);
    expect(err.text()).toBe('aviso\n');
  });

  it('draws in 80 columns when the terminal does not say, and erases nothing it did not draw', () => {
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
    expect(out.chunks).toEqual(['x\n']);
  });

  it('is erased for good by close', () => {
    const out = terminal();
    const footer = new StatusFooter(out, () => ['a', 'b']);

    footer.draw();
    footer.close();
    footer.close();

    expect(out.chunks).toEqual(['a\nb\n', ERASE_TWO]);
  });
});

describe('formatElapsed', () => {
  it('says hours, minutes and seconds, two digits each', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
    expect(formatElapsed(102_900)).toBe('00:01:42');
    expect(formatElapsed(3_723_000)).toBe('01:02:03');
    expect(formatElapsed(-5)).toBe('00:00:00');
  });
});
