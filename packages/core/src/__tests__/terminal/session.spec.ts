import { Session } from '../../terminal/session';
import type { SessionLineEvent } from '../../terminal/interfaces/terminal.interface';

const AT = new Date('2024-05-05T10:00:00.000Z');

function makeSession(bufferSize = 10, kill = jest.fn()): { session: Session; kill: jest.Mock } {
  const session = new Session({
    id: 'session-1',
    label: 'camera-backend',
    command: ['go', 'test', './...'],
    pid: 4242,
    startedAt: new Date('2024-01-01T00:00:00.000Z'),
    bufferSize,
    kill,
  });
  return { session, kill };
}

describe('Session', () => {
  it('starts running, with the info it was constructed with', () => {
    const { session } = makeSession();

    expect(session.getInfo()).toEqual({
      id: 'session-1',
      label: 'camera-backend',
      command: ['go', 'test', './...'],
      pid: 4242,
      startedAt: new Date('2024-01-01T00:00:00.000Z'),
      status: 'running',
      exitCode: null,
    });
  });

  it('returns a fresh snapshot from getInfo, not a shared mutable object', () => {
    const { session } = makeSession();

    const first = session.getInfo();
    session.appendLine('stdout', 'raw', 'formatted', AT);

    expect(session.getInfo()).not.toBe(first);
  });

  it('notifies line listeners with the appended event, live', () => {
    const { session } = makeSession();
    const received: SessionLineEvent[] = [];
    session.subscribe((event) => received.push(event));

    session.appendLine('stdout', 'raw line', '[camera-backend] raw line', AT);

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      sessionId: 'session-1',
      stream: 'stdout',
      raw: 'raw line',
      formatted: '[camera-backend] raw line',
    });
    expect(received[0]?.timestamp).toBe(AT);
  });

  it('replays buffered lines to a late subscriber before delivering live ones', () => {
    const { session } = makeSession();
    session.appendLine('stdout', 'first', 'formatted-first', AT);
    session.appendLine('stderr', 'second', 'formatted-second', AT);

    const received: string[] = [];
    session.subscribe((event) => received.push(event.raw));
    session.appendLine('stdout', 'third', 'formatted-third', AT);

    expect(received).toEqual(['first', 'second', 'third']);
  });

  it('only replays the last N lines once the buffer is over capacity', () => {
    const { session } = makeSession(2);
    session.appendLine('stdout', 'first', 'formatted-first', AT);
    session.appendLine('stdout', 'second', 'formatted-second', AT);
    session.appendLine('stdout', 'third', 'formatted-third', AT);

    const received: string[] = [];
    session.subscribe((event) => received.push(event.raw));

    expect(received).toEqual(['second', 'third']);
  });

  it('marks itself exited with the given exit code and signal', () => {
    const { session } = makeSession();

    session.markExited(1, 'SIGTERM');

    expect(session.getInfo()).toMatchObject({ status: 'exited', exitCode: 1 });
  });

  it('notifies exit listeners once, with the exit event', () => {
    const { session } = makeSession();
    const listener = jest.fn();
    session.onExit(listener);

    session.markExited(0, null);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sessionId: 'session-1',
      exitCode: 0,
      signalCode: null,
      error: null,
    });
  });

  it('ends the session with an error instead of leaving it running when output cannot be read', () => {
    const { session } = makeSession();
    const listener = jest.fn();
    session.onExit(listener);

    session.markFailed(new Error('stream closed unexpectedly'));

    expect(session.getInfo()).toMatchObject({ status: 'exited', exitCode: null });
    expect(listener).toHaveBeenCalledWith({
      sessionId: 'session-1',
      exitCode: null,
      signalCode: null,
      error: 'Error: stream closed unexpectedly',
    });
  });

  it('stops notifying a line listener once unsubscribed', () => {
    const { session } = makeSession();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);
    listener.mockClear();

    unsubscribe();
    session.appendLine('stdout', 'raw', 'formatted', AT);

    expect(listener).not.toHaveBeenCalled();
  });

  it('forwards kill() to the callback it was constructed with', () => {
    const { session, kill } = makeSession();

    session.kill('SIGINT');

    expect(kill).toHaveBeenCalledWith('SIGINT');
  });

  it('forwards kill() with no signal', () => {
    const { session, kill } = makeSession();

    session.kill();

    expect(kill).toHaveBeenCalledWith(undefined);
  });
});

describe('Session — stdin', () => {
  function withInput(input: { write: jest.Mock; end: jest.Mock } | null): Session {
    return new Session({
      id: 's',
      label: 'agent',
      command: ['claude'],
      pid: 1,
      startedAt: AT,
      bufferSize: 1,
      kill: jest.fn(),
      input,
    });
  }

  it('writes to stdin until it is closed, and closes it once', () => {
    const input = { write: jest.fn(), end: jest.fn() };
    const session = withInput(input);

    expect(session.write('um')).toBe(true);
    session.endInput();
    session.endInput();
    expect(session.write('dois')).toBe(false);
    expect(input.write.mock.calls).toEqual([['um']]);
    expect(input.end).toHaveBeenCalledTimes(1);
  });

  it('writes nothing without stdin, and stops writing once the process no longer reads it', () => {
    expect(withInput(null).write('x')).toBe(false);
    withInput(null).endInput();
    expect(makeSession().session.write('x')).toBe(false);

    const broken = {
      write: jest.fn(() => {
        throw new Error('EPIPE');
      }),
      end: jest.fn(() => {
        throw new Error('EPIPE');
      }),
    };
    const session = withInput(broken);
    expect(session.write('x')).toBe(false);
    expect(session.write('y')).toBe(false);
    expect(broken.write).toHaveBeenCalledTimes(1);

    const closing = withInput({ write: jest.fn(), end: broken.end });
    closing.endInput();
    expect(closing.write('z')).toBe(false);
  });
});
