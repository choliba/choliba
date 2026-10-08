import { globSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const ADD_FILES_USAGE = 'add_files <tag> <glob...>';

export interface PromptFile {
  /** Relative to the repo root, with `/` separators. */
  readonly path: string;
  readonly content: string;
}

/** The files a set of globs matches, from the repo root, each read once, sorted by path. */
export function readGlobs(repoRoot: string, globs: readonly string[]): readonly PromptFile[] {
  const paths = new Set(globs.flatMap((pattern) => globSync(pattern, { cwd: repoRoot })));
  return [...paths]
    .filter((path) => statSync(join(repoRoot, path)).isFile())
    .toSorted()
    .map((path) => ({ path, content: readFileSync(join(repoRoot, path), 'utf8') }));
}

export function formatFilesSection(tag: string, globs: readonly string[], files: readonly PromptFile[]): string {
  if (files.length === 0) {
    return `<${tag}>\n(nenhum arquivo encontrado: ${globs.join(' ')})\n</${tag}>`;
  }
  const parts = files.map((file) => `### ${file.path}\n\n${file.content}`);
  return [`<${tag}>`, ...parts, `</${tag}>`].join('\n\n');
}

/** The `add_files` action: the matched files, in the prompt between `<tag>` and `</tag>`. */
export function addFiles(repoRoot: string, tag: string, globs: readonly string[]): string {
  return formatFilesSection(tag, globs, readGlobs(repoRoot, globs));
}
