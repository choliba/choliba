import { LiveRegion } from '../live-region';
import { defaultStdout, type WritableWithColumns } from '../writable';

describe('LiveRegion', () => {
  it('prints permanent output and clears live rows on stop', () => {
    const chunks: string[] = [];
    const out: WritableWithColumns = { write: (chunk) => chunks.push(chunk) };
    const region = new LiveRegion(out);

    region.set({ id: 'a', text: 'running', since: Date.now() });
    region.printPermanent('done\n\n');
    region.stop();

    expect(chunks.join('')).toContain('done');
  });

  it('tracks rows, redraws with spinner frames and clears on stop', () => {
    jest.useFakeTimers();
    const chunks: string[] = [];
    const out: WritableWithColumns = { write: (chunk) => chunks.push(chunk) };
    const region = new LiveRegion(out, ['|', '/'], 100);

    region.set({ id: 'job', text: 'working', since: Date.now() });
    expect(region.has('job')).toBe(true);

    jest.advanceTimersByTime(100);
    expect(chunks.join('')).toContain('working');

    region.remove('job');
    expect(region.has('job')).toBe(false);

    region.set({ id: 'multi', text: 'line1\nline2', since: Date.now() });
    region.redraw();
    region.stop();
    jest.useRealTimers();
  });

  it('uses default stdout and clears an active spinner on stop', () => {
    jest.useFakeTimers();
    const writeSpy = jest.spyOn(defaultStdout, 'write').mockImplementation(() => true);
    const region = new LiveRegion();

    region.set({ id: 'job', text: 'working', since: Date.now() });
    jest.advanceTimersByTime(150);
    region.stop();

    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
    jest.useRealTimers();
  });

  it('redraws multi-line rows and handles an empty first line', () => {
    const chunks: string[] = [];
    const out: WritableWithColumns = { write: (chunk) => chunks.push(chunk) };
    const region = new LiveRegion(out, ['*']);

    region.set({ id: 'job', text: '\nsecond line', since: Date.now() });
    region.redraw();
    region.stop();

    expect(chunks.join('')).toContain('second line');
  });

  it('redraws rows with empty text', () => {
    const chunks: string[] = [];
    const out: WritableWithColumns = { write: (chunk) => chunks.push(chunk) };
    const region = new LiveRegion(out, ['*']);

    region.set({ id: 'job', text: '', since: Date.now() });
    region.redraw();
    region.stop();

    expect(chunks.join('')).toContain('*');
  });

  it('stop is safe before any rows are set', () => {
    const out: WritableWithColumns = { write: () => undefined };
    const region = new LiveRegion(out);

    expect(() => {
      region.stop();
    }).not.toThrow();
  });

  it('uses fallback spinner frame when frames array is empty', () => {
    const chunks: string[] = [];
    const out: WritableWithColumns = { write: (chunk) => chunks.push(chunk) };
    const region = new LiveRegion(out, []);

    region.set({ id: 'job', text: 'tick', since: Date.now() });
    region.redraw();
    region.stop();

    expect(chunks.join('')).toContain('? tick');
  });
});
