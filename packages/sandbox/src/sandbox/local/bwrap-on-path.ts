import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** The `bwrap` binary on `pathEnv` (or on `PATH`, when omitted), or `undefined` when none of its directories has one. */
export function bwrapOnPath(pathEnv?: string): string | undefined {
  const path = pathEnv ?? process.env['PATH'] ?? '';
  const directories = path.split(delimiter).filter((directory) => directory !== '');
  return directories.map((directory) => join(directory, 'bwrap')).find(executable);
}
