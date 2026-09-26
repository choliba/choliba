/**
 * The one seam between this package's testable logic and the real `Bun.spawn`.
 *
 * Jest runs specs under a plain Node environment, where the `Bun` global does not
 * exist — referencing it at module scope (a default parameter value, an
 * eagerly-built singleton) would throw the moment any spec imports this module
 * transitively through the barrel. So `spawn.ts` itself never touches `Bun`: it
 * only describes the shape it needs (`BunSpawnFn`, taken from Bun's own ambient
 * types, which are erased at compile time and never evaluated at runtime) and
 * exports a factory that everything else can inject a fake into. The literal
 * `Bun.spawn` value is read exactly once, in `cli/main.ts`, which is already
 * excluded from the coverage ratchet as a thin wiring entrypoint.
 */

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

export type BunSpawnFn = typeof Bun.spawn;

export function createBunProcessSpawner(spawnFn: BunSpawnFn): ProcessSpawner {
  return {
    spawn(options: SpawnCommandOptions): SpawnedProcess {
      const child = spawnFn([...options.command], {
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        ...(options.env !== undefined ? { env: options.env } : {}),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      return {
        pid: child.pid,
        stdout: child.stdout,
        stderr: child.stderr,
        exited: child.exited,
        get signalCode() {
          return child.signalCode;
        },
        kill(signal) {
          child.kill(signal);
        },
      };
    },
  };
}
