import { join } from 'node:path';

import { logStamp, NO_LOG, openLogFile, type Writable, type WritableWithColumns } from '@choliba/core';

/**
 * Where a line of the log came from: what the command wrote (`saida`, `erro`), each line the provider wrote, as it
 * came (`provider`, `provider-erro`), and what choliba decided along the run (`choliba`).
 */
export type RunLogSource = 'saida' | 'erro' | 'provider' | 'provider-erro' | 'choliba';

/** The log of one run: a file written as the run goes, one line at a time, so a run that stops leaves it up to there. */
export interface RunLog {
  /** The file, or `''` for a run that keeps none. */
  readonly path: string;
  write(source: RunLogSource, text: string): void;
}

/** The log of a run that keeps none (`--dry-run`, the specs). */
export const NO_RUN_LOG: RunLog = NO_LOG;

/** How many logs this process has opened, so two runs of one millisecond never share a file. */
let opened = 0;

/**
 * Opens the log of a run of `agent`, in `<dir>/<agent>/<date and time>.log`, with `header` first (`openLogFile`): each
 * line goes to the file at once, after its time and its source, without colors, and a log never changes a run's
 * outcome.
 */
export function openRunLog(dir: string, agent: string, header: readonly string[], now: () => Date): RunLog {
  opened += 1;
  const name = `${logStamp(now())}-${String(process.pid)}-${String(opened)}.log`;
  return openLogFile(join(dir, agent, name), header, now);
}

/** `stream`, writing each chunk to `log` too, under `source`; its other fields (`columns`, `isTTY`) as they are. */
export function loggedStream<Stream extends Writable | WritableWithColumns>(
  stream: Stream,
  log: RunLog,
  source: RunLogSource,
): Stream {
  const logged = Object.create(stream) as Stream;
  logged.write = (chunk: string) => {
    log.write(source, chunk);
    stream.write(chunk);
  };
  return logged;
}
