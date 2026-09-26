import { colorForLabel, formatLine } from '../../formatter';
import { ProcessRunner } from '../../process-runner';
import type { ProcessSpawner } from '../../spawn';
import { exitCodeFor, runCli } from '../../cli/run';
import type { SignalSource, Writable } from '../../cli/run';
import { erroringStream, fakeSpawner, streamFromChunks, throwingSpawner } from '../helpers/fake-spawner';

function fakeWritable(): Writable & { chunks: string[] } {
  const chunks: string[] = [];
  return {
    chunks,
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
}

function fakeSignalSource(): { source: SignalSource; trigger: (event: NodeJS.Signals) => void } {
  const listeners = new Map<NodeJS.Signals, Set<() => void>>();
  return {
    source: {
      on(event, listener) {
        const set = listeners.get(event) ?? new Set<() => void>();
        set.add(listener);
        listeners.set(event, set);
      },
      off(event, listener) {
        listeners.get(event)?.delete(listener);
      },
    },
    trigger(event) {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
  };
}

describe('runCli', () => {
  it('writes the parse error to stderr and returns 1 on invalid arguments', async () => {
    const stderr = fakeWritable();
    const runner = new ProcessRunner({ spawner: fakeSpawner().spawner });

    const exitCode = await runCli(['run'], { runner, stdout: fakeWritable(), stderr });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Usage: mono-terminal run');
  });

  it('writes a start failure to stderr and returns 1 when the command cannot be spawned', async () => {
    const stderr = fakeWritable();
    const runner = new ProcessRunner({ spawner: throwingSpawner(new Error('spawn ENOENT')) });

    const exitCode = await runCli(['run', '--label', 'x', '--', 'does-not-exist'], {
      runner,
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Failed to start "does-not-exist": Error: spawn ENOENT');
  });

  it('prints formatted stdout/stderr lines and resolves with the exit code', async () => {
    const { spawner } = fakeSpawner({
      stdout: streamFromChunks(['building\n']),
      stderr: streamFromChunks(['warning: x\n']),
      exitCode: 0,
    });
    const runner = new ProcessRunner({ spawner });
    const stdout = fakeWritable();
    const stderr = fakeWritable();

    const exitCode = await runCli(['run', '--label', 'vite', '--', 'vite'], { runner, stdout, stderr });
    const color = colorForLabel('vite');

    expect(exitCode).toBe(0);
    expect(stdout.chunks).toEqual([`${formatLine('vite', 'building', { color })}\n`]);
    expect(stderr.chunks).toEqual([`${formatLine('vite', 'warning: x', { color })}\n`]);
  });

  it('reports 128 + signal number when the process was killed by a signal', async () => {
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
    const runner = new ProcessRunner({ spawner: nullExitSpawner });

    const exitCode = await runCli(['run', '--label', 'x', '--', 'echo'], {
      runner,
      stdout: fakeWritable(),
      stderr: fakeWritable(),
    });

    // SIGKILL is 9, so the shell convention is 137 — distinguishable from a plain failure.
    expect(exitCode).toBe(137);
  });

  it('forwards SIGINT to the session and stops listening once it has exited', async () => {
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
    const runner = new ProcessRunner({ spawner });
    const { source, trigger } = fakeSignalSource();

    const pending = runCli(['run', '--label', 'x', '--', 'sleep', '1'], {
      runner,
      stdout: fakeWritable(),
      stderr: fakeWritable(),
      signals: source,
    });

    trigger('SIGINT');
    trigger('SIGTERM');
    expect(kill).toHaveBeenNthCalledWith(1, 'SIGINT');
    expect(kill).toHaveBeenNthCalledWith(2, 'SIGTERM');

    resolveExit(0);
    await expect(pending).resolves.toBe(0);
  });

  it('falls back to process stdout/stderr/signals when none are given', async () => {
    const runner = new ProcessRunner({ spawner: fakeSpawner({ exitCode: 0 }).spawner });

    await expect(runCli(['run', '--label', 'x', '--', 'echo'], { runner })).resolves.toBe(0);
  });

  it('passes --no-color through, so the printed line carries no ANSI of ours', async () => {
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['building\n']) });
    const runner = new ProcessRunner({ spawner });
    const stdout = fakeWritable();

    await runCli(['run', '--label', 'vite', '--no-color', '--', 'vite'], {
      runner,
      stdout,
      stderr: fakeWritable(),
    });

    expect(stdout.chunks).toEqual(['[vite] building\n']);
  });

  it('reports a stream failure on stderr and resolves instead of hanging', async () => {
    const { spawner } = fakeSpawner({ stdout: erroringStream(new Error('boom')) });
    const runner = new ProcessRunner({ spawner });
    const stderr = fakeWritable();

    const exitCode = await runCli(['run', '--label', 'x', '--', 'echo'], {
      runner,
      stdout: fakeWritable(),
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.chunks.join('')).toContain('Session for "echo" failed: Error: boom');
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
