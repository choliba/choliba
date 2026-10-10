import type { WritableWithColumns } from '../../platform';
import { defaultStderr, defaultStdout, isStdoutTty, writeStderr, writeStdout } from '../../terminal/writable';

describe('writable helpers', () => {
  it('writeStdout and writeStderr forward text to injectable streams', () => {
    const out: string[] = [];
    const err: string[] = [];
    const stdout: WritableWithColumns = { write: (chunk) => out.push(chunk) };
    const stderr: WritableWithColumns = { write: (chunk) => err.push(chunk) };

    writeStdout('ok\n', stdout);
    writeStderr('fail\n', stderr);

    expect(out).toEqual(['ok\n']);
    expect(err).toEqual(['fail\n']);
  });

  it('isStdoutTty reflects the stream flag', () => {
    const noopWrite = {
      write(_chunk: string): void {
        /* noop */
      },
    };
    expect(isStdoutTty({ ...noopWrite, isTTY: true })).toBe(true);
    expect(isStdoutTty({ ...noopWrite, isTTY: false })).toBe(false);
    expect(isStdoutTty(noopWrite)).toBe(false);
  });

  it('uses default stdout and stderr when no stream is passed', () => {
    const stdoutSpy = jest.spyOn(defaultStdout, 'write').mockImplementation(() => true);
    const stderrSpy = jest.spyOn(defaultStderr, 'write').mockImplementation(() => true);

    writeStdout('hello\n');
    writeStderr('fail\n');

    expect(stdoutSpy).toHaveBeenCalledWith('hello\n');
    expect(stderrSpy).toHaveBeenCalledWith('fail\n');
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('isStdoutTty uses default stdout when stream is omitted', () => {
    const previous = defaultStdout.isTTY;
    Object.defineProperty(defaultStdout, 'isTTY', { value: true, configurable: true });
    try {
      expect(isStdoutTty()).toBe(true);
    } finally {
      Object.defineProperty(defaultStdout, 'isTTY', { value: previous, configurable: true });
    }
  });
});
