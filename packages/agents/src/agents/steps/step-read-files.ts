import { globSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { untrustedBlock } from '../../common';

export const READ_FILES_USAGE = 'read_files <tag> <glob...>';

export interface PromptFile {
  /** As the glob matched it: relative to the repo root, or absolute for an absolute glob (an app outside the repo). */
  readonly path: string;
  readonly content: string;
}

/** The files a set of globs matches, from the repo root (an absolute glob as it is), each read once, sorted by path. */
export function readGlobs(repoRoot: string, globs: readonly string[]): readonly PromptFile[] {
  const paths = new Set(globs.flatMap((pattern) => globSync(pattern, { cwd: repoRoot })));
  return [...paths]
    .filter((path) => statSync(resolve(repoRoot, path)).isFile())
    .toSorted()
    .map((path) => ({ path, content: readFileSync(resolve(repoRoot, path), 'utf8') }));
}

export function formatFilesSection(tag: string, globs: readonly string[], files: readonly PromptFile[]): string {
  if (files.length === 0) {
    return `<${tag}>\n(nenhum arquivo encontrado: ${globs.join(' ')})\n</${tag}>`;
  }
  const parts = files.map((file) => untrustedBlock(`file:${file.path}`, file.content));
  return [`<${tag}>`, ...parts, `</${tag}>`].join('\n\n');
}

/** The `read_files` action: the matched files, in the prompt between `<tag>` and `</tag>`, each as untrusted data. */
export function readFiles(repoRoot: string, tag: string, globs: readonly string[]): string {
  return formatFilesSection(tag, globs, readGlobs(repoRoot, globs));
}
