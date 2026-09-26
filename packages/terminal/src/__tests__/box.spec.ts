import { printBox } from '../box';
import { defaultStdout, type WritableWithColumns } from '../writable';

describe('printBox', () => {
  it('writes bordered lines to the provided stream', () => {
    const chunks: string[] = [];
    const stream: WritableWithColumns = {
      columns: 40,
      write(chunk: string) {
        chunks.push(chunk);
      },
    };

    printBox(['Projeto: demo'], { stream });

    expect(chunks.join('')).toContain('Projeto: demo');
    expect(chunks.join('')).toMatch(/^-+\n\|/);
  });

  it('uses explicit cols and caps width at 120', () => {
    const chunks: string[] = [];
    const stream: WritableWithColumns = {
      columns: 200,
      write(chunk: string) {
        chunks.push(chunk);
      },
    };

    printBox(['wide'], { stream, cols: 150 });

    const border = chunks[0] ?? '';
    expect(border.trim().length).toBeLessThanOrEqual(121);
  });

  it('falls back to 80 columns when stream has no width', () => {
    const chunks: string[] = [];
    const stream: WritableWithColumns = { write: (chunk) => chunks.push(chunk) };

    printBox(['fallback'], { stream });

    expect((chunks[0] ?? '').length).toBe(81);
  });

  it('uses default stdout when no options are passed', () => {
    const writeSpy = jest.spyOn(defaultStdout, 'write').mockImplementation(() => true);

    printBox(['default stream']);

    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('prefers stream width when cols is zero', () => {
    const chunks: string[] = [];
    const stream: WritableWithColumns = {
      columns: 42,
      write: (chunk) => chunks.push(chunk),
    };

    printBox(['stream width'], { stream, cols: 0 });

    expect((chunks[0] ?? '').length).toBe(43);
  });
});
