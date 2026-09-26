import type { ProcessSpawner, SpawnCommandOptions, SpawnedProcess } from '../../spawn';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function streamFromChunks(chunks: readonly string[], delayMs = 0): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        if (delayMs > 0) {
          await delay(delayMs);
        }
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/** A stream that fails mid-read, to exercise the runner's failure path. */
export function erroringStream(error: Error): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(error);
    },
  });
}

/** A process that never exits, for asserting that running sessions are never evicted. */
export function pendingSpawner(): ProcessSpawner {
  return {
    spawn(): SpawnedProcess {
      return {
        pid: 1,
        stdout: streamFromChunks([]),
        stderr: streamFromChunks([]),
        exited: new Promise<number>(() => undefined),
        signalCode: null,
        kill: jest.fn(),
      };
    },
  };
}

export interface FakeSpawnedProcessOptions {
  readonly pid?: number;
  readonly stdout?: ReadableStream<Uint8Array> | null;
  readonly stderr?: ReadableStream<Uint8Array> | null;
  readonly exitCode?: number;
  readonly signalCode?: NodeJS.Signals | null;
}

export interface FakeSpawner {
  readonly spawner: ProcessSpawner;
  readonly kill: jest.Mock;
  readonly spawnCalls: SpawnCommandOptions[];
}

export function fakeSpawner(options: FakeSpawnedProcessOptions = {}): FakeSpawner {
  const kill = jest.fn();
  const spawnCalls: SpawnCommandOptions[] = [];
  const spawner: ProcessSpawner = {
    spawn(cmdOptions: SpawnCommandOptions): SpawnedProcess {
      spawnCalls.push(cmdOptions);
      return {
        pid: options.pid ?? 1234,
        stdout: options.stdout === undefined ? streamFromChunks([]) : options.stdout,
        stderr: options.stderr === undefined ? streamFromChunks([]) : options.stderr,
        exited: Promise.resolve(options.exitCode ?? 0),
        signalCode: options.signalCode ?? null,
        kill,
      };
    },
  };
  return { spawner, kill, spawnCalls };
}

export function throwingSpawner(error: Error): ProcessSpawner {
  return {
    spawn(): SpawnedProcess {
      throw error;
    },
  };
}
