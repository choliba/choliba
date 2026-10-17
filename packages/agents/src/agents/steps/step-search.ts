import { readdirSync, type Dirent } from 'node:fs';
import { resolve } from 'node:path';

import { compilePathPatterns } from '@choliba/core';

/** What every search skips, at any depth: dependencies, builds, git and caches (path patterns, as `ignore`). */
export const DEFAULT_IGNORE: readonly string[] = ['node_modules', 'vendor', 'dist', 'build', '.git', '.cache'];

/**
 * Where and what the file steps look for, both as path patterns (`compilePathPatterns`), relative to each folder:
 * `pattern`, the files to find; `ignore`, what to skip, files or folders, with all under them. `maxDepth` is how many
 * levels it goes down (1: only what the folder holds); without it, all of them.
 */
export interface FileSearch {
  readonly pattern?: readonly string[];
  readonly ignore?: readonly string[];
  readonly maxDepth?: number;
}

/** What one folder holds, as paths relative to it with `/`: its files (those `pattern` matches) and its folders. */
export interface FolderTree {
  readonly files: readonly string[];
  readonly folders: readonly string[];
  /** The `maxDepth` that left folders unread, when it did. */
  readonly cutAt?: number;
}

/** The entries of `dir`; none when it cannot be read (it does not exist, or has no read permission). */
function entriesOf(dir: string): readonly Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * What `dir` (relative to `repoRoot`, or absolute) holds, sorted: every folder under it, and the files `search.pattern`
 * matches (every file without one). What `DEFAULT_IGNORE` or `search.ignore` matches is skipped, a folder with all
 * under it; a link is not followed, and a folder it cannot read is passed over. Folders below `search.maxDepth` are
 * listed but not read, and `cutAt` says so.
 */
export function searchFolder(repoRoot: string, dir: string, search: FileSearch): FolderTree {
  const ignored = compilePathPatterns([...DEFAULT_IGNORE, ...(search.ignore ?? [])]);
  const pattern = search.pattern ?? [];
  const wanted = pattern.length === 0 ? undefined : compilePathPatterns(pattern);
  const maxDepth = search.maxDepth ?? Number.POSITIVE_INFINITY;
  const files: string[] = [];
  const folders: string[] = [];
  const unread: string[] = [];

  const walk = (absolute: string, relative: string, depth: number): void => {
    for (const entry of entriesOf(absolute)) {
      const path = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (ignored.matches(path, entry.isDirectory())) continue;
      if (entry.isDirectory()) {
        folders.push(path);
        if (depth < maxDepth) walk(resolve(absolute, entry.name), path, depth + 1);
        else unread.push(path);
        continue;
      }
      if (entry.isFile() && (wanted === undefined || wanted.matches(path, false))) files.push(path);
    }
  };

  walk(resolve(repoRoot, dir), '', 1);
  const tree = { files: files.toSorted(), folders: folders.toSorted() };
  return unread.length > 0 ? { ...tree, cutAt: maxDepth } : tree;
}
