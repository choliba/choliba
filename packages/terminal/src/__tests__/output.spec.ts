import * as output from '../output';

describe('output entrypoint', () => {
  it('re-exports terminal output helpers', () => {
    expect(typeof output.printBox).toBe('function');
    expect(typeof output.formatDuration).toBe('function');
    expect(typeof output.writeStdout).toBe('function');
    expect(typeof output.writeStderr).toBe('function');
    expect(typeof output.isStdoutTty).toBe('function');
    expect(output.LiveRegion).toBeDefined();
    expect(output.DEFAULT_SPINNER_FRAMES.length).toBeGreaterThan(0);
    expect(output.defaultStdout).toBeDefined();
    expect(output.defaultStderr).toBeDefined();
    expect(typeof output.isStdoutTty).toBe('function');
  });
});
