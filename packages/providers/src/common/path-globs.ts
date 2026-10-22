import { statSync } from 'node:fs';

import { pathGlobs as domainPathGlobs } from '@choliba/domain';

function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function pathGlobs(path: string, folder: (path: string) => boolean = isFolder): readonly string[] {
  return domainPathGlobs(path, folder);
}
