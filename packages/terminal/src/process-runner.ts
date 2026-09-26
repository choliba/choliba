import { randomUUID } from 'node:crypto';

import type { FormatterOptions } from './formatter';
import { colorForLabel, formatLine } from './formatter';
import type { Listener } from './event-emitter';
import { TypedEventEmitter } from './event-emitter';
import type { ProcessSpawner } from './spawn';
import { Session } from './session';
import { readLines } from './stream-lines';
import type { ProcessRunnerEvents, RunOptions, StreamName } from './types';

export interface ProcessRunnerOptions {
  /**
   * No default here on purpose: giving this a `Bun.spawn`-based default would put a
   * reference to the `Bun` global on a code path every caller of `ProcessRunner` can
   * reach, including specs running under Jest's Node environment (see `spawn.ts`).
   * Production code builds one with `createBunProcessSpawner(Bun.spawn)` in `cli/main.ts`.
   */
  readonly spawner: ProcessSpawner;
  readonly bufferSize?: number;
  /**
   * How many already-exited sessions stay listable. Running sessions are never
   * discarded. A CLI process dies with its command, so this never bites there; a
   * long-lived host (extension point (b), the WebSocket transport) would otherwise
   * accumulate every session it ever ran, with its line buffer, for as long as it runs.
   */
  readonly maxRetainedSessions?: number;
}

const DEFAULT_BUFFER_SIZE = 500;
const DEFAULT_MAX_RETAINED_SESSIONS = 50;

/**
 * Orchestrates sessions: spawns a command, formats its output, and re-emits each
 * session's own events as global `session-start`/`session-line`/`session-exit`
 * events. Extension point (b): a future WebSocket transport subscribes here the
 * same way the CLI wrapper does, and calls `Session.subscribe()` for replay when a
 * client connects mid-session. Extension point (a): a persistence layer is just
 * another subscriber that writes what it receives to SQLite.
 *
 * This is also the only place in the package that reads the clock, so each output
 * line carries exactly one timestamp (see `Session.appendLine`).
 */
export class ProcessRunner {
  private readonly sessions = new Map<string, Session>();
  /** Ids of exited sessions, oldest first — the eviction order for retention. */
  private readonly retired: string[] = [];
  private readonly emitter = new TypedEventEmitter<ProcessRunnerEvents>();
  private readonly spawner: ProcessSpawner;
  private readonly bufferSize: number;
  private readonly maxRetainedSessions: number;

  constructor(options: ProcessRunnerOptions) {
    this.spawner = options.spawner;
    this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;
    const maxRetained = options.maxRetainedSessions ?? DEFAULT_MAX_RETAINED_SESSIONS;
    if (!Number.isInteger(maxRetained) || maxRetained < 0) {
      throw new Error(`maxRetainedSessions must be a non-negative integer, got ${String(maxRetained)}`);
    }
    this.maxRetainedSessions = maxRetained;
  }

  /**
   * Spawns the command and returns its `Session` immediately (pid already known);
   * stdout/stderr populate asynchronously. A synchronous spawn failure (e.g. the
   * command does not exist) propagates as a thrown error — no session is created.
   */
  start(options: RunOptions): Session {
    const spawned = this.spawner.spawn({
      command: options.command,
      ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
      ...(options.env !== undefined ? { env: options.env } : {}),
    });

    const id = randomUUID();
    const session = new Session({
      id,
      label: options.label,
      command: options.command,
      pid: spawned.pid,
      startedAt: new Date(),
      bufferSize: this.bufferSize,
      kill: (signal) => {
        spawned.kill(signal);
      },
    });
    this.sessions.set(id, session);

    session.subscribe((event) => {
      this.emitter.emit('session-line', event);
    });
    session.onExit((event) => {
      // Emit before retiring, so a subscriber reacting to the exit can still look the
      // session up; retiring only ever evicts sessions that exited earlier than this one.
      this.emitter.emit('session-exit', event);
      this.retire(id);
    });
    this.emitter.emit('session-start', session.getInfo());

    const style: FormatterOptions = {
      color: options.color ?? colorForLabel(options.label),
      colorize: options.colorize !== false,
    };
    const withTimestamp = options.withTimestamp === true;

    const pipeStream = async (stream: ReadableStream<Uint8Array> | null, streamName: StreamName): Promise<void> => {
      if (!stream) {
        return;
      }
      for await (const raw of readLines(stream)) {
        const at = new Date();
        const formatted = formatLine(options.label, raw, {
          ...style,
          ...(withTimestamp ? { timestamp: at } : {}),
        });
        session.appendLine(streamName, raw, formatted, at);
      }
    };

    void Promise.all([spawned.exited, pipeStream(spawned.stdout, 'stdout'), pipeStream(spawned.stderr, 'stderr')])
      .then(([exitCode]) => {
        session.markExited(exitCode, spawned.signalCode);
      })
      .catch((error: unknown) => {
        // Without this the rejection was unhandled and the session stayed 'running'
        // forever, so nobody awaiting its exit — the CLI wrapper included — ever woke up.
        session.markFailed(error);
      });

    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  listSessions(): readonly Session[] {
    return [...this.sessions.values()];
  }

  on<K extends keyof ProcessRunnerEvents & string>(event: K, listener: Listener<ProcessRunnerEvents[K]>): () => void {
    return this.emitter.on(event, listener);
  }

  /**
   * `splice` with a non-positive count removes nothing and returns an empty array, so
   * the common case needs no branch of its own.
   */
  private retire(id: string): void {
    this.retired.push(id);
    for (const evicted of this.retired.splice(0, this.retired.length - this.maxRetainedSessions)) {
      this.sessions.delete(evicted);
    }
  }
}
