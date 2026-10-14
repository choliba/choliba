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

/** The first of `names` in `start` or the nearest folder above it that has one, every name tried at each level. */
function findUp(start: string, names: readonly string[]): string | undefined {
  let dir = resolve(start);
  for (;;) {
    const candidate = names.map((name) => join(dir, name)).find((path) => existsSync(path));
    if (candidate !== undefined) {
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
 * Where to look for what the code ships with, in order: the folder of the script that is actually running,
 * then `sourceDir` (the caller's own `__dirname`, which a bundle freezes to where it was built).
 */
export function resourceStarts(sourceDir: string, argv: readonly string[] = process.argv): readonly string[] {
  return [runningScriptDir(argv), sourceDir].filter((start): start is string => start !== undefined);
}

/**
 * `resourceStarts` without the folders that are not on this machine. A bundle freezes `sourceDir` to where
 * the code was built, and that path is written into a script the user runs: only a folder that exists belongs there.
 */
export function existingResourceStarts(sourceDir: string, argv: readonly string[] = process.argv): readonly string[] {
  return resourceStarts(sourceDir, argv).filter((start) => existsSync(start));
}

/**
 * The directory of the file the bundle actually loaded. The build writes it on `globalThis` from that file's
 * `import.meta.url`, because this module is also loaded by Jest, which cannot parse `import.meta`. Absent from
 * the sources and from the `bin`, where the running script is enough.
 */
function shippedDir(): string | undefined {
  const value = (globalThis as { readonly __CHOLIBA_SHIPPED_DIR__?: unknown }).__CHOLIBA_SHIPPED_DIR__;
  if (typeof value !== 'string' || value === '') {
    return undefined;
  }
  return value;
}

/** `resourceStarts`, plus the shipped directory when the bundle set one and it is not already there. */
function locateStarts(sourceDir: string, argv: readonly string[]): readonly string[] {
  const starts = resourceStarts(sourceDir, argv);
  const shipped = shippedDir();
  if (shipped === undefined || starts.includes(shipped)) {
    return starts;
  }
  return [...starts, shipped];
}

/**
 * A file or folder the code ships with (`schemes`, `templates/ticket`…), looked up from the script
 * that is actually running, then from `sourceDir` (the caller's own `__dirname`), then from the directory
 * the bundle loaded; `undefined` when none finds it. Bundled, the script of an import is the user's file and
 * `__dirname` is frozen to where the source was built, so the shipped directory is what still holds the
 * resources. The `bin` finds them from its own script, and from the sources both lead to the same package.
 */
export function locateResource(
  relative: string | readonly string[],
  sourceDir: string,
  argv: readonly string[] = process.argv,
): string | undefined {
  // Several names (a file built under another extension) are tried together from each start: the first start holds the
  // package that runs, and a name only another start has (the sources a bundle remembers) must not win over it.
  const names = typeof relative === 'string' ? [relative] : relative;
  for (const start of locateStarts(sourceDir, argv)) {
    const found = findUp(start, names);
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
