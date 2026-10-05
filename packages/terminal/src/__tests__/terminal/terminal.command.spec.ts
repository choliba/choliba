import { BufferWritable, fakePlatform, FakeSignals, runCommand, type FakePlatform } from '@choliba/core/testing';

import { formatLine } from '../../terminal/formatter';
import type { ProcessSpawner } from '../../terminal/spawn';
import { exitCodeFor } from '../../terminal/exit-code';
import { TerminalModule } from '../../terminal/terminal.module';
import { erroringStream, fakeSpawner, streamFromChunks, throwingSpawner } from '../helpers/fake-spawner';

function platformFor(args: readonly string[], overrides: Partial<FakePlatform> = {}): FakePlatform {
  return fakePlatform({ argv: ['terminal', ...args], ...overrides });
}

function run(platform: FakePlatform): Promise<number> {
  return runCommand([TerminalModule], platform);
}

describe('choliba terminal run', () => {
  it('writes the parse error to stderr and exits 1 on invalid arguments', async () => {
    const platform = platformFor(['run'], { spawn: fakeSpawner().spawner });

    expect(await run(platform)).toBe(1);
    expect(platform.stderr.text()).toContain('Usage: choliba terminal run');
  });

  it('writes a start failure to stderr and exits 1 when the command cannot be spawned', async () => {
    const platform = platformFor(['run', '--label', 'x', '--', 'does-not-exist'], {
      spawn: throwingSpawner(new Error('spawn ENOENT')),
    });

    expect(await run(platform)).toBe(1);
    expect(platform.stderr.text()).toContain('Failed to start "does-not-exist": Error: spawn ENOENT');
  });

  it('prints labeled stdout/stderr lines, colored at a terminal, and exits with the exit code', async () => {
    const { spawner } = fakeSpawner({
      stdout: streamFromChunks(['building\n']),
      stderr: streamFromChunks(['warning: x\n']),
      exitCode: 0,
    });
    const platform = platformFor(['run', '--label', 'vite', '--', 'vite'], {
      spawn: spawner,
      stdout: new BufferWritable(true),
    });

    expect(await run(platform)).toBe(0);
    // `vite` has no color of its own in the theme, so it gets the one derived from its name.
    expect(platform.stdout.chunks).toEqual([`${formatLine('vite', 'building')}\n`]);
    expect(platform.stderr.chunks).toEqual([`${formatLine('vite', 'warning: x')}\n`]);
  });

  it('labels with the theme color of a known label', async () => {
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['hi\n']) });
    const platform = platformFor(['run', '--label', 'provider', '--', 'x'], {
      spawn: spawner,
      stdout: new BufferWritable(true),
    });

    await run(platform);

    expect(platform.stdout.chunks).toEqual([`${formatLine('provider', 'hi', { color: 'magenta' })}\n`]);
  });

  it('prints no color of its own with --no-color or in a pipe', async () => {
    const flagged = platformFor(['run', '--label', 'vite', '--', 'vite'], {
      spawn: fakeSpawner({ stdout: streamFromChunks(['building\n']) }).spawner,
      stdout: new BufferWritable(true),
      noColorFlag: true,
    });
    const piped = platformFor(['run', '--label', 'vite', '--', 'vite'], {
      spawn: fakeSpawner({ stdout: streamFromChunks(['building\n']) }).spawner,
    });

    await run(flagged);
    await run(piped);

    expect(flagged.stdout.chunks).toEqual(['[vite] building\n']);
    expect(piped.stdout.chunks).toEqual(['[vite] building\n']);
  });

  it('exits with 128 + signal number when the process was killed by a signal', async () => {
    const nullExitSpawner: ProcessSpawner = {
      spawn: () => ({
        pid: 1,
        stdout: streamFromChunks([]),
        stderr: streamFromChunks([]),
        exited: Promise.resolve(null as unknown as number),
        signalCode: 'SIGKILL',
        kill: jest.fn(),
      }),
    };

    // SIGKILL is 9, so the shell convention is 137 — distinguishable from a plain failure.
    expect(await run(platformFor(['run', '--label', 'x', '--', 'echo'], { spawn: nullExitSpawner }))).toBe(137);
  });

  it('forwards SIGINT and SIGTERM to the session and stops listening once it has exited', async () => {
    const kill = jest.fn();
    let resolveExit: (code: number) => void = () => undefined;
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const spawner: ProcessSpawner = {
      spawn: () => ({
        pid: 1,
        stdout: streamFromChunks([]),
        stderr: streamFromChunks([]),
        exited,
        signalCode: null,
        kill,
      }),
    };
    const signals = new FakeSignals();
    const platform = platformFor(['run', '--label', 'x', '--', 'sleep', '1'], { spawn: spawner, signals });

    const pending = run(platform);
    await new Promise((resolve) => setImmediate(resolve));
    while (signals.count('SIGINT') === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    signals.emit('SIGINT');
    signals.emit('SIGTERM');
    expect(kill).toHaveBeenNthCalledWith(1, 'SIGINT');
    expect(kill).toHaveBeenNthCalledWith(2, 'SIGTERM');

    resolveExit(0);
    await expect(pending).resolves.toBe(0);
    expect(signals.count('SIGINT')).toBe(0);
    expect(signals.count('SIGTERM')).toBe(0);
  });

  it('reports a stream failure on stderr and exits instead of hanging', async () => {
    const platform = platformFor(['run', '--label', 'x', '--', 'echo'], {
      spawn: fakeSpawner({ stdout: erroringStream(new Error('boom')) }).spawner,
    });

    expect(await run(platform)).toBe(1);
    expect(platform.stderr.text()).toContain('Session for "echo" failed: Error: boom');
  });
});

describe('exitCodeFor', () => {
  const signals = { SIGINT: 2, SIGKILL: 9 };

  it('passes a real exit code straight through, including 0', () => {
    expect(exitCodeFor({ sessionId: 'a', exitCode: 0, signalCode: null, error: null }, signals)).toBe(0);
    expect(exitCodeFor({ sessionId: 'a', exitCode: 3, signalCode: null, error: null }, signals)).toBe(3);
  });

  it('maps a known signal to 128 + its number', () => {
    expect(exitCodeFor({ sessionId: 'a', exitCode: null, signalCode: 'SIGINT', error: null }, signals)).toBe(130);
    expect(exitCodeFor({ sessionId: 'a', exitCode: null, signalCode: 'SIGKILL', error: null }, signals)).toBe(137);
  });

  it('falls back to 1 for a signal the platform does not name', () => {
    expect(
      exitCodeFor({ sessionId: 'a', exitCode: null, signalCode: 'SIGUNKNOWN' as NodeJS.Signals, error: null }, signals),
    ).toBe(1);
  });

  it('falls back to 1 when there is neither an exit code nor a signal', () => {
    expect(exitCodeFor({ sessionId: 'a', exitCode: null, signalCode: null, error: null }, signals)).toBe(1);
  });

  it('defaults to the host signal table when none is given', () => {
    expect(exitCodeFor({ sessionId: 'a', exitCode: null, signalCode: 'SIGINT', error: null })).toBe(130);
  });
});
