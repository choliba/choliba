import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** The folder of the script this process runs, links resolved; none when it has no script file. */
function runningScriptDir(argv: readonly string[]): string | undefined {
  const script = argv[1];
  if (script === undefined || !existsSync(script)) {
    return undefined;
  }
  return dirname(realpathSync(script));
}

function findUp(start: string, relative: string): string | undefined {
  let dir = resolve(start);
  for (;;) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

/**
 * A file or folder the code ships with (`schemes`, `templates/ticket`…), looked up from the script
 * that is actually running, then from `sourceDir` (the caller's own `__dirname`); `undefined` when
 * neither finds it. Bundled, the script is the installed `bin/choliba.js` and its package holds the
 * resources, while `__dirname` is frozen to where the source was built; from the sources, both lead
 * to the same package.
 */
export function locateResource(
  relative: string,
  sourceDir: string,
  argv: readonly string[] = process.argv,
): string | undefined {
  const starts = [runningScriptDir(argv), sourceDir].filter((start): start is string => start !== undefined);
  for (const start of starts) {
    const found = findUp(start, relative);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** `locateResource`, or — when it is found nowhere — the path next to `sourceDir`, so an error names a real place. */
export function findResource(relative: string, sourceDir: string, argv: readonly string[] = process.argv): string {
  return locateResource(relative, sourceDir, argv) ?? join(sourceDir, '..', relative);
}
