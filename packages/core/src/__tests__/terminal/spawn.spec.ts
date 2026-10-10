import { createBunProcessSpawner, type BunSpawnFn } from '../../terminal/spawn';

/**
 * The fake stands in for "whatever `Bun.spawn` would have returned" so
 * `createBunProcessSpawner`'s mapping can run without the real `Bun` global,
 * which does not exist under Jest's Node environment.
 */
function fakeBunSpawn(recordedCalls: unknown[][]): BunSpawnFn {
  const fake = (...args: unknown[]): unknown => {
    recordedCalls.push(args);
    return {
      pid: 4242,
      stdout: 'stdout-stream',
      stderr: 'stderr-stream',
      exited: Promise.resolve(0),
      signalCode: null,
      kill: jest.fn(),
    };
  };
  return fake as unknown as BunSpawnFn;
}

describe('createBunProcessSpawner', () => {
  it('forwards command, cwd and env to the given spawn function, always piping stdout/stderr', () => {
    const calls: unknown[][] = [];
    const spawner = createBunProcessSpawner(fakeBunSpawn(calls));

    spawner.spawn({ command: ['echo', 'hi'], cwd: '/tmp', env: { FOO: 'bar' } });

    expect(calls).toEqual([[['echo', 'hi'], { cwd: '/tmp', env: { FOO: 'bar' }, stdout: 'pipe', stderr: 'pipe' }]]);
  });

  it('maps the returned subprocess fields onto SpawnedProcess', async () => {
    const spawner = createBunProcessSpawner(fakeBunSpawn([]));

    const spawned = spawner.spawn({ command: ['echo', 'hi'] });

    expect(spawned.pid).toBe(4242);
    expect(spawned.stdout).toBe('stdout-stream');
    expect(spawned.stderr).toBe('stderr-stream');
    expect(spawned.signalCode).toBeNull();
    await expect(spawned.exited).resolves.toBe(0);
  });

  it('forwards kill() to the underlying subprocess', () => {
    const killSpy = jest.fn();
    const fake = ((): unknown => ({
      pid: 1,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      signalCode: null,
      kill: killSpy,
    })) as unknown as BunSpawnFn;
    const spawner = createBunProcessSpawner(fake);

    const spawned = spawner.spawn({ command: ['sleep', '1'] });
    spawned.kill('SIGTERM');

    expect(killSpy).toHaveBeenCalledWith('SIGTERM');
  });

  it('keeps a named signal and drops a numeric one', () => {
    const named = createBunProcessSpawner(((): unknown => ({
      pid: 1,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      signalCode: 'SIGTERM',
      kill: jest.fn(),
    })) as unknown as BunSpawnFn).spawn({ command: ['sleep', '1'] });
    const numbered = createBunProcessSpawner(((): unknown => ({
      pid: 1,
      stdout: null,
      stderr: null,
      exited: Promise.resolve(0),
      signalCode: 15,
      kill: jest.fn(),
    })) as unknown as BunSpawnFn).spawn({ command: ['sleep', '1'] });

    expect(named.signalCode).toBe('SIGTERM');
    expect(numbered.signalCode).toBeNull();
  });
});
