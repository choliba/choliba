import type { GitRunner } from '../git-run';

/** Where a command writes: `process.stdout`/`process.stderr` in production, a buffer in specs. */
export interface Writable {
  write(chunk: string): void;
}

export interface WritableWithColumns extends Writable {
  columns?: number;
  isTTY?: boolean;
}

export interface SignalSource {
  on(event: NodeJS.Signals, listener: () => void): void;
  off(event: NodeJS.Signals, listener: () => void): void;
}

export interface SpawnCommandOptions {
  readonly command: readonly string[];
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
}

export interface SpawnedProcess {
  readonly pid: number;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly exited: Promise<number>;
  readonly signalCode: NodeJS.Signals | null;
  kill(signal?: NodeJS.Signals): void;
}

export interface ProcessSpawner {
  spawn(options: SpawnCommandOptions): SpawnedProcess;
}

/** The process environment, as `process.env` gives it. */
export type Environment = Readonly<Record<string, string | undefined>>;

export type Clock = () => Date;

/** Asks the person at the terminal `question` and resolves with what they typed, trimmed. */
export type Ask = (question: string) => Promise<string>;

/** `Bun.which`: the path of an executable on PATH, or null. */
export type Which = (bin: string) => string | null;

/**
 * Everything choliba reads from the process and the runtime. Only `main.ts` builds the real one
 * (Bun and `process`); specs pass fakes to `PlatformModule.forRoot`, since Jest runs on Node.
 */
export interface Platform {
  /** The command line after the executable and the script, without the global `--no-color`. */
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly env: Environment;
  readonly stdout: WritableWithColumns;
  readonly stderr: WritableWithColumns;
  readonly clock: Clock;
  readonly signals: SignalSource;
  readonly spawn: ProcessSpawner;
  readonly which: Which;
  readonly git: GitRunner;
  /** Asks at the terminal; absent when stdin is no terminal, so a command takes its defaults or names the flag. */
  readonly ask?: Ask;
  /** `--no-color` was passed: a global flag, removed from the arguments before any command parses them. */
  readonly noColorFlag: boolean;
}
