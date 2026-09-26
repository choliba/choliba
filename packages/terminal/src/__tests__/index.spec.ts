import * as terminal from '../index';

describe('public entrypoint', () => {
  it('re-exports the core runner API', () => {
    expect(terminal.ProcessRunner).toBeDefined();
    expect(terminal.Session).toBeDefined();
    expect(terminal.CircularBuffer).toBeDefined();
    expect(terminal.TypedEventEmitter).toBeDefined();
    expect(terminal.createBunProcessSpawner).toBeDefined();
    expect(terminal.readLines).toBeDefined();
    expect(typeof terminal.colorForLabel).toBe('function');
    expect(typeof terminal.formatLine).toBe('function');
    expect(typeof terminal.exitCodeFor).toBe('function');
    expect(typeof terminal.printBox).toBe('function');
    expect(typeof terminal.formatDuration).toBe('function');
    expect(typeof terminal.writeStdout).toBe('function');
    expect(terminal.LiveRegion).toBeDefined();
    expect(terminal.defaultStdout).toBeDefined();
    expect(terminal.defaultStderr).toBeDefined();
    expect(typeof terminal.isStdoutTty).toBe('function');
    expect(typeof terminal.writeStderr).toBe('function');
    expect(terminal.DEFAULT_SPINNER_FRAMES.length).toBeGreaterThan(0);
  });

  it('exposes a working ProcessRunner end to end through the barrel', () => {
    const spawnCalls: unknown[] = [];
    const runner = new terminal.ProcessRunner({
      spawner: {
        spawn(options) {
          spawnCalls.push(options);
          return {
            pid: 1,
            stdout: null,
            stderr: null,
            exited: Promise.resolve(0),
            signalCode: null,
            kill: () => undefined,
          };
        },
      },
    });

    const session = runner.start({ label: 'x', command: ['echo'] });

    expect(session.getInfo().status).toBe('running');
    expect(spawnCalls).toEqual([{ command: ['echo'] }]);
  });
});
