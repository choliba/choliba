import type { AnsiColor } from './formatter';

export type SessionStatus = 'running' | 'exited';

export type StreamName = 'stdout' | 'stderr';

export interface SessionInfo {
  readonly id: string;
  readonly label: string;
  readonly command: readonly string[];
  readonly pid: number;
  readonly startedAt: Date;
  readonly status: SessionStatus;
  readonly exitCode: number | null;
}

export interface SessionLineEvent {
  readonly sessionId: string;
  readonly stream: StreamName;
  readonly raw: string;
  readonly formatted: string;
  readonly timestamp: Date;
}

export interface SessionExitEvent {
  readonly sessionId: string;
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  /**
   * Set when the session ended because reading its output failed, rather than because
   * the process itself exited. Without this, such a failure surfaced as an unhandled
   * rejection and the session stayed 'running' forever, leaving every subscriber —
   * including the CLI wrapper awaiting an exit — hanging.
   */
  readonly error: string | null;
}

export interface RunOptions {
  readonly label: string;
  readonly command: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /** Overrides the color derived from the label. */
  readonly color?: AnsiColor;
  /** `false` suppresses every ANSI code this package adds. Defaults to `true`. */
  readonly colorize?: boolean;
  /** Prefixes each line with an ISO timestamp. Defaults to `false`. */
  readonly withTimestamp?: boolean;
}

// Extension point (b): a future WebSocket transport subscribes to the same
// event shapes exposed here, so it can reuse these types without redefining them.
export interface ProcessRunnerEvents extends Record<string, unknown> {
  'session-start': SessionInfo;
  'session-line': SessionLineEvent;
  'session-exit': SessionExitEvent;
}

export interface SessionEvents extends Record<string, unknown> {
  line: SessionLineEvent;
  exit: SessionExitEvent;
}
