import { ProcessRunnerService } from '../../terminal/process-runner.service';
import type { Session } from '../../terminal/session';
import type { SessionExitEvent, SessionLineEvent } from '../../terminal/interfaces/terminal.interface';
import {
  erroringStream,
  fakeSpawner,
  pendingSpawner,
  streamFromChunks,
  throwingSpawner,
} from '../helpers/fake-spawner';

function waitForExit(runner: ProcessRunnerService): Promise<SessionExitEvent> {
  return new Promise((resolve) => {
    runner.on('session-exit', resolve);
  });
}

function exitOf(session: Session): Promise<SessionExitEvent> {
  return new Promise((resolve) => {
    session.onExit(resolve);
  });
}

describe('ProcessRunnerService', () => {
  it('returns a running session synchronously, with the spawned pid', () => {
    const { spawner } = fakeSpawner({ pid: 555 });
    const runner = new ProcessRunnerService({ spawner });

    const session = runner.start({ label: 'camera-backend', command: ['go', 'test'] });

    expect(session.getInfo()).toMatchObject({
      label: 'camera-backend',
      command: ['go', 'test'],
      pid: 555,
      status: 'running',
    });
  });

  it('passes command, cwd and env through to the spawner', () => {
    const { spawner, spawnCalls } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner });

    runner.start({ label: 'x', command: ['echo', 'hi'], cwd: '/tmp', env: { FOO: 'bar' } });

    expect(spawnCalls).toEqual([{ command: ['echo', 'hi'], cwd: '/tmp', env: { FOO: 'bar' } }]);
  });

  it('emits session-start with the session info as soon as it starts', () => {
    const { spawner } = fakeSpawner({ pid: 9 });
    const runner = new ProcessRunnerService({ spawner });
    const listener = jest.fn();
    runner.on('session-start', listener);

    runner.start({ label: 'x', command: ['echo'] });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ pid: 9, status: 'running' }));
  });

  it('registers the session so it can be looked up by id and listed', () => {
    const { spawner } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner });

    const session = runner.start({ label: 'x', command: ['echo'] });

    expect(runner.getSession(session.getInfo().id)).toBe(session);
    expect(runner.listSessions()).toEqual([session]);
  });

  it('returns undefined for an unknown session id', () => {
    const runner = new ProcessRunnerService({ spawner: fakeSpawner().spawner });

    expect(runner.getSession('missing')).toBeUndefined();
  });

  it('formats and forwards stdout/stderr lines as session-line events, tagged by stream', async () => {
    const { spawner } = fakeSpawner({
      stdout: streamFromChunks(['building\n']),
      stderr: streamFromChunks(['warning: x\n']),
    });
    const runner = new ProcessRunnerService({ spawner });
    const lines: SessionLineEvent[] = [];
    runner.on('session-line', (event) => lines.push(event));

    runner.start({ label: 'vite', command: ['vite'], color: 'blue' });
    await waitForExit(runner);

    const byStream = Object.fromEntries(lines.map((line) => [line.stream, line]));
    expect(byStream['stdout']).toMatchObject({ raw: 'building', formatted: '\u001b[34m[vite]\u001b[0m building' });
    expect(byStream['stderr']).toMatchObject({
      raw: 'warning: x',
      formatted: '\u001b[34m[vite]\u001b[0m warning: x',
    });
  });

  it('does not crash when a stream is null', async () => {
    const { spawner } = fakeSpawner({ stdout: null, stderr: null });
    const runner = new ProcessRunnerService({ spawner });

    runner.start({ label: 'x', command: ['echo'] });

    await expect(waitForExit(runner)).resolves.toMatchObject({ exitCode: 0 });
  });

  it('marks the session exited and emits session-exit once the process exits', async () => {
    const { spawner } = fakeSpawner({ exitCode: 3, signalCode: 'SIGTERM' });
    const runner = new ProcessRunnerService({ spawner });

    const session = runner.start({ label: 'x', command: ['echo'] });
    const exitEvent = await waitForExit(runner);

    expect(exitEvent).toEqual({ sessionId: session.getInfo().id, exitCode: 3, signalCode: 'SIGTERM', error: null });
    expect(session.getInfo()).toMatchObject({ status: 'exited', exitCode: 3 });
  });

  it('only reports the session exited after every buffered line has been delivered', async () => {
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['one\n', 'two\n', 'three\n'], 5) });
    const runner = new ProcessRunnerService({ spawner });
    const lines: SessionLineEvent[] = [];
    runner.on('session-line', (event) => lines.push(event));

    runner.start({ label: 'x', command: ['echo'] });
    await waitForExit(runner);

    expect(lines.map((line) => line.raw)).toEqual(['one', 'two', 'three']);
  });

  it('lets a session subscriber replay lines and receive the exit event', async () => {
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['hello\n']) });
    const runner = new ProcessRunnerService({ spawner });

    const session = runner.start({ label: 'x', command: ['echo'] });
    const received: string[] = [];
    session.subscribe((event) => received.push(event.raw));
    await waitForExit(runner);

    expect(received).toEqual(['hello']);
  });

  it('propagates a synchronous spawn failure without registering a session', () => {
    const error = new Error('spawn ENOENT');
    const runner = new ProcessRunnerService({ spawner: throwingSpawner(error) });

    expect(() => {
      runner.start({ label: 'x', command: ['does-not-exist'] });
    }).toThrow('spawn ENOENT');
    expect(runner.listSessions()).toEqual([]);
  });

  it('forwards kill() on the session to the underlying spawned process', () => {
    const { spawner, kill } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner });

    const session = runner.start({ label: 'x', command: ['sleep', '1'] });
    session.kill('SIGINT');

    expect(kill).toHaveBeenCalledWith('SIGINT');
  });

  it('uses the configured buffer size for each session', () => {
    const { spawner } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner, bufferSize: 2 });

    const session = runner.start({ label: 'x', command: ['echo'] });
    const at = new Date();
    session.appendLine('stdout', 'a', 'a', at);
    session.appendLine('stdout', 'b', 'b', at);
    session.appendLine('stdout', 'c', 'c', at);

    const replayed: string[] = [];
    session.subscribe((event) => replayed.push(event.raw));

    expect(replayed).toEqual(['b', 'c']);
  });

  it('passes colorize through, so no ANSI of ours reaches a redirected stream', async () => {
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['building\n']) });
    const runner = new ProcessRunnerService({ spawner });
    const lines: SessionLineEvent[] = [];
    runner.on('session-line', (event) => lines.push(event));

    runner.start({ label: 'vite', command: ['vite'], colorize: false });
    await waitForExit(runner);

    expect(lines[0]?.formatted).toBe('[vite] building');
  });

  it('gives each line a single timestamp, shared by the formatted text and the event', async () => {
    const { spawner } = fakeSpawner({ stdout: streamFromChunks(['hello\n']) });
    const runner = new ProcessRunnerService({ spawner });
    const lines: SessionLineEvent[] = [];
    runner.on('session-line', (event) => lines.push(event));

    runner.start({ label: 'x', command: ['echo'], withTimestamp: true });
    await waitForExit(runner);

    const line = lines[0];
    expect(line?.formatted).toContain(line?.timestamp.toISOString());
  });

  it('ends the session with an error when a stream fails, rather than leaving it running', async () => {
    const { spawner } = fakeSpawner({ stdout: erroringStream(new Error('boom')) });
    const runner = new ProcessRunnerService({ spawner });

    const session = runner.start({ label: 'x', command: ['echo'] });
    const exitEvent = await exitOf(session);

    expect(exitEvent).toMatchObject({ exitCode: null, signalCode: null, error: 'Error: boom' });
    expect(session.getInfo()).toMatchObject({ status: 'exited', exitCode: null });
  });

  it('evicts the oldest exited sessions past maxRetainedSessions', async () => {
    const { spawner } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner, maxRetainedSessions: 1 });

    const first = runner.start({ label: 'a', command: ['echo'] });
    await exitOf(first);
    const second = runner.start({ label: 'b', command: ['echo'] });
    await exitOf(second);

    expect(runner.getSession(first.getInfo().id)).toBeUndefined();
    expect(runner.listSessions()).toEqual([second]);
  });

  it('retains no exited session at all when maxRetainedSessions is 0', async () => {
    const { spawner } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner, maxRetainedSessions: 0 });

    const session = runner.start({ label: 'a', command: ['echo'] });
    await exitOf(session);

    expect(runner.listSessions()).toEqual([]);
  });

  it('never evicts a session that is still running', () => {
    const runner = new ProcessRunnerService({ spawner: pendingSpawner(), maxRetainedSessions: 0 });

    const running = runner.start({ label: 'dev-server', command: ['vite'] });

    expect(runner.listSessions()).toEqual([running]);
  });

  it('still lets a session-exit subscriber look the session up', async () => {
    const { spawner } = fakeSpawner();
    const runner = new ProcessRunnerService({ spawner, maxRetainedSessions: 0 });
    let foundDuringEvent: Session | undefined;
    const session = runner.start({ label: 'a', command: ['echo'] });
    runner.on('session-exit', (event) => {
      foundDuringEvent = runner.getSession(event.sessionId);
    });

    await exitOf(session);

    expect(foundDuringEvent).toBe(session);
  });

  it('rejects a maxRetainedSessions that is not a non-negative integer', () => {
    const { spawner } = fakeSpawner();

    expect(() => new ProcessRunnerService({ spawner, maxRetainedSessions: -1 })).toThrow(/non-negative integer/);
    expect(() => new ProcessRunnerService({ spawner, maxRetainedSessions: 1.5 })).toThrow(/non-negative integer/);
  });
});
