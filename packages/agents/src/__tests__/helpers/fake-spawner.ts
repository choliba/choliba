import type { ProcessSpawner, SpawnCommandOptions, SpawnedProcess } from '@choliba/terminal';

/**
 * A minimal fake `ProcessSpawner` for `ProcessRunnerService`, so `run-agent.spec.ts` exercises the
 * real runner and session lifecycle without ever touching `Bun.spawn`. Mirrors the shape of
 * `@choliba/terminal`'s own test helper, which lives under its `src/__tests__/` and is not
 * importable across packages.
 */

export function streamFromChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/** A stream that fails mid-read, to exercise the runner's `Session.markFailed` path. */
export function erroringStream(error: Error): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(error);
    },
  });
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
