import { sep } from 'node:path';

/** What starts an exception in a deny list. */
export const EXCEPTION_PREFIX = '!';

const GLOB = /[*?[\]]/;

export function isException(path: string): boolean {
  return path.startsWith(EXCEPTION_PREFIX);
}

export function exceptionPath(path: string): string {
  return path.slice(EXCEPTION_PREFIX.length);
}

export function hasGlob(path: string): boolean {
  return GLOB.test(path);
}

export function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function isWithin(root: string, path: string): boolean {
  return root === sep || path === root || path.startsWith(`${root}${sep}`);
}

export function denyExceptions(entries: readonly string[]): readonly string[] {
  return entries.filter(isException).map((entry) => withoutTrailingSlash(exceptionPath(entry)));
}
