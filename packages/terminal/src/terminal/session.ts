import { CircularBuffer } from './circular-buffer';
import type { Listener } from './event-emitter';
import { TypedEventEmitter } from './event-emitter';
import type {
  SessionEvents,
  SessionExitEvent,
  SessionInfo,
  SessionLineEvent,
  SessionStatus,
  StreamName,
} from './interfaces/terminal.interface';

export interface SessionParams {
  readonly id: string;
  readonly label: string;
  readonly command: readonly string[];
  readonly pid: number;
  readonly startedAt: Date;
  readonly bufferSize: number;
  readonly kill: (signal?: NodeJS.Signals) => void;
}

/**
 * The single source of truth for one spawned process: its metadata, its recent-lines
 * buffer, and the events other modules (the CLI wrapper today, a WebSocket transport
 * later) subscribe to. `ProcessRunner` only re-emits what a `Session` already knows,
 * so there is never a second buffer or a second copy of the truth to drift from this one.
 */
export class Session {
  private status: SessionStatus = 'running';
  private exitCode: number | null = null;
  private readonly buffer: CircularBuffer<SessionLineEvent>;
  private readonly emitter = new TypedEventEmitter<SessionEvents>();

  constructor(private readonly params: SessionParams) {
    this.buffer = new CircularBuffer<SessionLineEvent>(params.bufferSize);
  }

  getInfo(): SessionInfo {
    return {
      id: this.params.id,
      label: this.params.label,
      command: this.params.command,
      pid: this.params.pid,
      startedAt: this.params.startedAt,
      status: this.status,
      exitCode: this.exitCode,
    };
  }

  /**
   * `timestamp` is supplied by the caller rather than sampled here, so the time shown
   * in `formatted` and the time carried by the event are one reading of the clock.
   */
  appendLine(stream: StreamName, raw: string, formatted: string, timestamp: Date): void {
    const event: SessionLineEvent = {
      sessionId: this.params.id,
      stream,
      raw,
      formatted,
      timestamp,
    };
    this.buffer.push(event);
    this.emitter.emit('line', event);
  }

  markExited(exitCode: number | null, signalCode: NodeJS.Signals | null): void {
    this.finish(exitCode, signalCode, null);
  }

  /** Ends the session because its output could not be read, never leaving it 'running'. */
  markFailed(error: unknown): void {
    this.finish(null, null, String(error));
  }

  private finish(exitCode: number | null, signalCode: NodeJS.Signals | null, error: string | null): void {
    this.status = 'exited';
    this.exitCode = exitCode;
    this.emitter.emit('exit', { sessionId: this.params.id, exitCode, signalCode, error });
  }

  /** Forwards a signal to the underlying process (e.g. Ctrl+C on a wrapped `vite`). */
  kill(signal?: NodeJS.Signals): void {
    this.params.kill(signal);
  }

  /** Replays the buffered history synchronously, then wires the listener to live lines. */
  subscribe(listener: Listener<SessionLineEvent>): () => void {
    for (const event of this.buffer.toArray()) {
      listener(event);
    }
    return this.emitter.on('line', listener);
  }

  onExit(listener: Listener<SessionExitEvent>): () => void {
    return this.emitter.on('exit', listener);
  }
}
