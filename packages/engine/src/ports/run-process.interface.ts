export interface RunProcessLine {
  readonly stream: 'stdout' | 'stderr';
  readonly raw: string;
}

export interface RunProcessExit {
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  readonly error: string | null;
}

export interface RunProcess {
  write(text: string): boolean;
  endInput(): void;
  kill(signal?: NodeJS.Signals): void;
  subscribe(listener: (event: RunProcessLine) => void): () => void;
  onExit(listener: (event: RunProcessExit) => void): () => void;
}

export interface RunProcessOptions {
  readonly label: string;
  readonly command: readonly string[];
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly input?: boolean;
}

export interface RunProcessRunner {
  start(options: RunProcessOptions): RunProcess;
}
