import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { untrustedBlock, type AgentStep } from '../../common';
import { listField, textField, type FieldSpec } from './step-fields';
import { loadListing } from './step-listing';
import { compilePathPatterns } from '@choliba/core';

import { searchFolder } from './step-search';
import { checkSectionSize, parseMaxSize } from './step-size';

export const READ_FILES_USAGE = 'read_files: { tag, files | dirs + pattern | source + pattern, ignore?, max_size? }';

/**
 * The fields of `read_files`, saying which files in one of three ways: by their paths (`files`), what `pattern` finds in
 * `dirs`, or what `pattern` picks from the list a `search_files` saved (`source`). `dirs` and `source` always take a
 * `pattern`, so a step never reads whole folders by mistake.
 */
export const READ_FILES_FIELDS: FieldSpec = {
  required: ['tag'],
  optional: ['files', 'dirs', 'source', 'pattern', 'ignore', 'max_size'],
  lists: ['files', 'dirs', 'pattern', 'ignore'],
  rule: (step) => {
    const has = (name: string): boolean => step.options?.[name] !== undefined;
    const ways = [has('files'), has('dirs'), has('source')].filter(Boolean).length;
    const needsPattern = has('dirs') || has('source');
    return ways === 1 && has('pattern') === needsPattern
      ? undefined
      : 'use files, dirs com pattern, ou source com pattern';
  },
};

export interface PromptFile {
  /** Its folder from `dirs` as written, then its path in it: relative to the repo root, or absolute. */
  readonly path: string;
  readonly content: string;
}

/** The paths `pattern` matches in each of `dirs` (skipping `ignore`), each once, sorted: its folder, then its path. */
export function matchingPaths(
  repoRoot: string,
  dirs: readonly string[],
  pattern: readonly string[],
  ignore: readonly string[],
): readonly string[] {
  const paths = dirs.flatMap((dir) =>
    searchFolder(repoRoot, dir, { pattern, ignore }).files.map((file) => join(dir, file)),
  );
  return [...new Set(paths)].toSorted();
}

/** The paths `pattern` picks from the list saved in `source`, each once, sorted: its folder, then its path. */
export function listedPaths(repoRoot: string, source: string, pattern: readonly string[]): readonly string[] {
  const wanted = compilePathPatterns(pattern);
  const paths = loadListing(repoRoot, source).flatMap(({ dir, files }) =>
    files.filter((file) => wanted.matches(file, false)).map((file) => join(dir, file)),
  );
  return [...new Set(paths)].toSorted();
}

/** The paths the step names: `files` that exist, what `pattern` picks from `source`, or what it finds in `dirs`. */
function stepPaths(repoRoot: string, step: AgentStep): readonly string[] {
  const files = listField(step, 'files');
  if (files.length > 0) return files.filter((path) => existsSync(resolve(repoRoot, path)));
  const source = textField(step, 'source');
  const pattern = listField(step, 'pattern');
  if (source !== '') return listedPaths(repoRoot, source, pattern);
  return matchingPaths(repoRoot, listField(step, 'dirs'), pattern, listField(step, 'ignore'));
}

/** What the step asked for, as the section says when nothing matched. */
function wantedOf(step: AgentStep): string {
  const files = listField(step, 'files');
  if (files.length > 0) return files.join(' ');
  const from = textField(step, 'source') === '' ? listField(step, 'dirs').join(' ') : textField(step, 'source');
  return `${listField(step, 'pattern').join(' ')} em ${from}`;
}

/** What `paths` hold, read once each. */
export function readPaths(repoRoot: string, paths: readonly string[]): readonly PromptFile[] {
  return paths.map((path) => ({ path, content: readFileSync(resolve(repoRoot, path), 'utf8') }));
}

export function formatFilesSection(tag: string, wanted: string, files: readonly PromptFile[]): string {
  if (files.length === 0) {
    return `<${tag}>\n(nenhum arquivo encontrado: ${wanted})\n</${tag}>`;
  }
  const parts = files.map((file) => untrustedBlock(`file:${file.path}`, file.content));
  return [`<${tag}>`, ...parts, `</${tag}>`].join('\n\n');
}

/**
 * The `read_files` action: what the files hold (those named in `files` that exist, those `pattern` picks from the
 * list in `source`, or those it matches in `dirs`), in the prompt between `<tag>` and `</tag>`, each as untrusted data.
 * A section larger than `max_size` stops the step.
 */
export function readFiles(repoRoot: string, step: AgentStep): string {
  const tag = textField(step, 'tag');
  const maxSize = parseMaxSize(textField(step, 'max_size'));
  const paths = stepPaths(repoRoot, step);
  // The files' own sizes first: a pattern that matches thousands stops before any of them is read.
  const bytes = paths.reduce((total, path) => total + statSync(resolve(repoRoot, path)).size, 0);
  checkSectionSize(tag, bytes, maxSize, paths.length);
  const section = formatFilesSection(tag, wantedOf(step), readPaths(repoRoot, paths));
  checkSectionSize(tag, Buffer.byteLength(section, 'utf8'), maxSize, paths.length);
  return section;
}
