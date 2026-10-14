/**
 * The one seam between this package's testable logic and the real `Bun.spawn`.
 *
 * Jest runs specs under a plain Node environment, where the `Bun` global does not
 * exist — referencing it at module scope (a default parameter value, an
 * eagerly-built singleton) would throw the moment any spec imports this module
 * transitively through the barrel. So `spawn.ts` itself never touches `Bun`: it
 * only describes the shape it needs (`BunSpawnFn`, a structural slice, never the
 * `Bun` global) and exports a factory that everything else can inject a fake
 * into. The literal
 * `Bun.spawn` value is read exactly once, in choliba's `main.ts`, which is already
 * excluded from the coverage ratchet as a thin wiring entrypoint.
 */

import type { ProcessSpawner, SpawnCommandOptions, SpawnedProcess } from '../platform';

/** The slice of `Bun.spawn` this factory calls. Named without the `Bun` global so every package can typecheck it. */
export type BunSpawnFn = (
  command: readonly string[],
  options: {
    readonly cwd?: string;
    readonly env?: Record<string, string | undefined>;
    readonly stdin?: 'pipe';
    readonly stdout: 'pipe';
    readonly stderr: 'pipe';
  },
) => {
  readonly pid: number;
  /** Bun's `FileSink` when spawned with `stdin: 'pipe'`. */
  readonly stdin?: { write(chunk: string): unknown; flush(): unknown; end(): unknown } | null | number;
  readonly stdout: ReadableStream<Uint8Array> | null;
  readonly stderr: ReadableStream<Uint8Array> | null;
  readonly exited: Promise<number>;
  readonly signalCode: NodeJS.Signals | number | null;
  kill(signal?: NodeJS.Signals | number): void;
};

export function createBunProcessSpawner(spawnFn: BunSpawnFn): ProcessSpawner {
  return {
    spawn(options: SpawnCommandOptions): SpawnedProcess {
      const child = spawnFn([...options.command], {
        ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
        ...(options.env !== undefined ? { env: options.env } : {}),
        ...(options.input === true ? { stdin: 'pipe' as const } : {}),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const sink = typeof child.stdin === 'object' ? child.stdin : null;
      return {
        pid: child.pid,
        stdout: child.stdout,
        stderr: child.stderr,
        stdin:
          sink === null
            ? null
            : {
                write: (text) => {
                  sink.write(text);
                  sink.flush();
                },
                end: () => {
                  sink.end();
                },
              },
        exited: child.exited,
        get signalCode(): NodeJS.Signals | null {
          return typeof child.signalCode === 'string' ? child.signalCode : null;
        },
        kill(signal) {
          child.kill(signal);
        },
      };
    },
  };
}
