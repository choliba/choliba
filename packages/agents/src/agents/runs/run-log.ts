import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { textPieces, type Writable, type WritableWithColumns } from '@choliba/core';

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
export const NO_RUN_LOG: RunLog = {
  path: '',
  write: () => undefined,
};

/** `text` as it reads, without its colors and styles. */
function plain(text: string): string {
  return textPieces(text)
    .filter((piece) => piece.width > 0)
    .map((piece) => piece.text)
    .join('');
}

/** How many logs this process has opened, so two runs of one millisecond never share a file. */
let opened = 0;

/**
 * Opens the log of a run of `agent`, in `<dir>/<agent>/<date and time>.log`, with `header` first. Each line written
 * goes to the file at once, after the time it was written and its source, without colors:
 *
 *     2026-10-18T20:58:01.123Z [provider] {"type":"item.started",…}
 */
export function openRunLog(dir: string, agent: string, header: readonly string[], now: () => Date): RunLog {
  const folder = join(dir, agent);
  mkdirSync(folder, { recursive: true });
  opened += 1;
  const stamp = now().toISOString().replaceAll(':', '-');
  const path = join(folder, `${stamp}-${String(process.pid)}-${String(opened)}.log`);
  appendFileSync(path, `${header.join('\n')}\n\n`);
  return {
    path,
    write: (source, text) => {
      const lines = plain(text).replace(/\n$/, '').split('\n');
      const at = now().toISOString();
      appendFileSync(path, lines.map((line) => `${at} [${source}] ${line}\n`).join(''));
    },
  };
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
