import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const LOG_TAIL_LINES = 15;

/** The last lines of `logFile`, indented, after a line break: what explains a failure; nothing when it is empty. */
export function logTail(logFile: string): string {
  if (!existsSync(logFile)) return '';
  const lines = readFileSync(logFile, 'utf8').trimEnd().split('\n').slice(-LOG_TAIL_LINES);
  return lines.join('\n') === '' ? '' : `\n${lines.map((line) => `  ${line}`).join('\n')}`;
}

/** Empties `logFile` (creating its folder): a new log each time, as the end of it is what explains a failure. */
export function freshLog(logFile: string): void {
  mkdirSync(dirname(logFile), { recursive: true });
  writeFileSync(logFile, '');
}

/**
 * Runs `use` with a descriptor of `logFile` open for appending, closed after: what a process writes there never
 * overwrites what was written beside it (a note of choliba's), as every write goes to the end.
 */
export function withAppendLog<T>(logFile: string, use: (descriptor: number) => T): T {
  const descriptor = openSync(logFile, 'a');
  try {
    return use(descriptor);
  } finally {
    closeSync(descriptor);
  }
}
