import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { textPieces } from './frame';

/** A log written as things happen, one line at a time, so whatever stops it leaves it up to there. */
export interface LogFile {
  /** The file, or `''` for a log that keeps nothing. */
  readonly path: string;
  /** Adds `text`, line by line, each after the time it was written and its `source`, without colors. */
  write(source: string, text: string): void;
}

/** A log that keeps nothing (`--dry-run`, the specs). */
export const NO_LOG: LogFile = {
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

/**
 * Opens the log at `path`, with `header` first. Each line written goes to the file at once, after the time it was
 * written and its source, without colors:
 *
 *     2026-10-18T20:58:01.123Z [provider] {"type":"item.started",…}
 *
 * A log never changes what it records: when its file or its folder is gone (deleted meanwhile), they are made again
 * and the line goes on; any other failure to write is ignored.
 */
export function openLogFile(path: string, header: readonly string[], now: () => Date): LogFile {
  const append = (content: string): void => {
    try {
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, content);
    } catch {
      // Not even made again (no room, no permission): what is logged goes on without this line.
    }
  };
  append(`${header.join('\n')}\n\n`);
  return {
    path,
    write: (source, text) => {
      const lines = plain(text).replace(/\n$/, '').split('\n');
      const at = now().toISOString();
      append(lines.map((line) => `${at} [${source}] ${line}\n`).join(''));
    },
  };
}

/** The name of a log opened at `now`, safe in a file name: `2026-10-18T20-58-01.123Z`. */
export function logStamp(now: Date): string {
  return now.toISOString().replaceAll(':', '-');
}
