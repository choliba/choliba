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

/**
 * The executable `name` in the first of the directories of `pathEnv` (a `PATH`; the process's when omitted) that has
 * one, or `undefined`. What a shell finds, for code that has no `Platform.which` at hand (a library, the sandbox).
 */
export function commandOnPath(name: string, pathEnv?: string): string | undefined {
  const path = pathEnv ?? process.env['PATH'] ?? '';
  const directories = path.split(delimiter).filter((directory) => directory !== '');
  return directories.map((directory) => join(directory, name)).find(executable);
}
