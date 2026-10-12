import { dirname } from 'node:path';

/** A directory as written in `execute` (`/x/` or `/x`), without the trailing `/`. */
export function withoutTrailingSlash(dir: string): string {
  return dir.length > 1 && dir.endsWith('/') ? dir.slice(0, -1) : dir;
}

/** The directory a declared path lives under: the part before the first glob segment, or its folder. */
export function pathBase(path: string): string {
  const segments = path.split('/');
  const globAt = segments.findIndex((segment) => /[*?[\]]/.test(segment));
  if (globAt !== -1) {
    return segments.slice(0, globAt).join('/') || '/';
  }
  return path.endsWith('/') ? path.slice(0, -1) || '/' : dirname(path);
}
