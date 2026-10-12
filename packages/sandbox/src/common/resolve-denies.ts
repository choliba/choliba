import { readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

/** One entry of a directory: its name and whether it is a folder (a symlink counts as a file). */
export interface DirEntry {
  readonly name: string;
  readonly isDirectory: boolean;
}

/** The entries of `dir`, or none when it cannot be read. */
export type ReadDir = (dir: string) => readonly DirEntry[];

export const readDir: ReadDir = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return [];
  }
};

/** What starts an exception in a `deny` list, as in `.gitignore`: `!x` takes `x` out of the denies around it. */
export const EXCEPTION_PREFIX = '!';

const GLOB = /[*?[\]]/;

export function isException(path: string): boolean {
  return path.startsWith(EXCEPTION_PREFIX);
}

/** The path an exception names, without its `!`. */
export function exceptionPath(path: string): string {
  return path.slice(EXCEPTION_PREFIX.length);
}

export function hasGlob(path: string): boolean {
  return GLOB.test(path);
}

/** A path without the trailing `/`, except `/` itself. */
function trimmed(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Whether `path` is `root` or lies under it. */
export function isWithin(root: string, path: string): boolean {
  return root === sep || path === root || path.startsWith(`${root}${sep}`);
}

/** The folders from `/` down to (not including) `path`: `/a/b/c` → `/`, `/a`, `/a/b`. */
function ancestors(path: string): readonly string[] {
  const found: string[] = [];
  for (let dir = dirname(path); ; dir = dirname(dir)) {
    found.unshift(dir);
    if (dir === dirname(dir)) {
      return found;
    }
  }
}

function leadsTo(kept: string, path: string): boolean {
  return isWithin(path, kept) || isWithin(kept, path);
}

/**
 * Everything under `root` (the whole disk by default) that is not one of `kept` nor on the way to one, as the
 * fewest paths: in each folder from `root` down to a kept path, every entry that leads to no kept path. What is
 * created after the list is made, right in one of those folders, is not in it.
 */
export function complementOf(kept: readonly string[], read: ReadDir, root: string = sep): readonly string[] {
  const denied = new Set<string>();
  const folders = new Set(kept.flatMap(ancestors).filter((dir) => isWithin(root, dir)));
  for (const dir of folders) {
    for (const entry of read(dir)) {
      const path = join(dir, entry.name);
      if (!kept.some((keptPath) => leadsTo(keptPath, path))) {
        denied.add(entry.isDirectory ? `${path}/` : path);
      }
    }
  }
  return [...denied].sort();
}

/** The exceptions of a `deny` list (absolute), as plain paths. */
export function denyExceptions(entries: readonly string[]): readonly string[] {
  return entries.filter(isException).map((entry) => trimmed(exceptionPath(entry)));
}

/** The exceptions of `entries` that lie strictly under `deny`, a folder (a glob is never carved). */
function exceptionsUnder(deny: string, exceptions: readonly string[]): readonly string[] {
  if (hasGlob(deny)) {
    return [];
  }
  const root = trimmed(deny);
  return exceptions.filter((exception) => exception !== root && isWithin(root, exception));
}

/**
 * A `deny` list (absolute paths) without its exceptions, the same for every provider: a deny that holds an
 * exception becomes everything inside it except the way to that exception (`complementOf`), so no provider
 * ever gets an allow and a deny that disagree. The exception itself is then neither denied nor allowed: what
 * is in it is still reachable only through an `allow`.
 */
export function resolveDenies(entries: readonly string[], read: ReadDir = readDir): readonly string[] {
  const exceptions = denyExceptions(entries);
  return entries
    .filter((entry) => !isException(entry))
    .flatMap((deny) => {
      const inner = exceptionsUnder(deny, exceptions);
      return inner.length === 0 ? [deny] : complementOf(inner, read, trimmed(deny));
    });
}

/** The exceptions of `entries` that lie under none of its denies, so they take nothing out. */
export function strayExceptions(entries: readonly string[]): readonly string[] {
  const denies = entries.filter((entry) => !isException(entry));
  return denyExceptions(entries).filter(
    (exception) => !denies.some((deny) => exceptionsUnder(deny, [exception]).length > 0),
  );
}
