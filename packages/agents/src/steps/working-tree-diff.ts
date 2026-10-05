import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { GitRunner } from '@choliba/core/platform';

import { getWorkingTreeDiff } from './git-working-tree-diff';
import { indexDiff } from './index-diff';

import { pendingSinceHint, resolveDiffBase, type DiffBaseConfig } from './git-state';

/** `git_diff <base> <arquivo> [--pending <estado>]`, already split. */
export interface GitDiffConfig extends DiffBaseConfig {
  readonly diffFile: string;
}

export const GIT_DIFF_USAGE = 'git_diff <base> <arquivo> [--pending <estado>]';

/** The arguments of a `git_diff` line, or `undefined` when they do not match `GIT_DIFF_USAGE`. */
export function parseGitDiffArgs(args: readonly string[]): GitDiffConfig | undefined {
  const [defaultBase, diffFile, flag, sincePendingState] = args;
  if (defaultBase === undefined || diffFile === undefined) {
    return undefined;
  }
  if (args.length === 2) {
    return { defaultBase, diffFile, sincePendingState: undefined };
  }
  if (args.length === 4 && flag === '--pending') {
    return { defaultBase, diffFile, sincePendingState };
  }
  return undefined;
}

export function writeDiffFile(repoRoot: string, diffFile: string, diff: string): string {
  const absolute = join(repoRoot, diffFile);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, diff, 'utf8');
  return diffFile;
}

/** Removes a diff left by an earlier run, so the file never shows changes the current run did not find. */
export function removeDiffFile(repoRoot: string, diffFile: string): void {
  rmSync(join(repoRoot, diffFile), { force: true });
}

export interface BuildWorkingTreeDiffPromptInput {
  readonly diffFilePath: string;
  readonly diff: string;
  readonly base: string;
}

export function buildWorkingTreeDiffPrompt(input: BuildWorkingTreeDiffPromptInput): string {
  const files = indexDiff(input.diff);
  const size = `${String(input.diff.split('\n').length)} linhas, ${String(Math.round(input.diff.length / 1024))} KB, ${String(files.length)} arquivos`;
  const index = files
    .map((file) => `${file.status} ${file.path} (linha ${String(file.line)}, ${String(file.lines)} linhas)`)
    .join('\n');

  return [
    `O diff calculado por quem chamou este comando está em \`${input.diffFilePath}\` (${size}; base \`${input.base}\`, working tree, com arquivos novos, sem trash/plans/.cache). É a ÚNICA fonte de verdade sobre o que mudou: leia-o com Read, em partes (offset/limit), indo direto ao que interessa pelo índice abaixo — não rode git log/git diff/git show por conta própria.`,
    `Índice do diff (A novo, D removido, R renomeado, M modificado):\n${index}`,
  ].join('\n\n');
}

export interface GitDiffInput {
  readonly repoRoot: string;
  /** `--since` from the command line; `undefined` uses the configured base. */
  readonly since: string | undefined;
}

export interface GitDiffDeps {
  readonly getDiff?: typeof getWorkingTreeDiff;
  readonly writeDiff?: typeof writeDiffFile;
  readonly removeDiff?: typeof removeDiffFile;
  readonly resolveBase?: typeof resolveDiffBase;
  readonly pendingHint?: typeof pendingSinceHint;
  readonly runner?: GitRunner;
}

/**
 * The `git_diff` action: diffs the base (or `--since`) against the working tree, writes the patch to
 * `config.diffFile` and returns the prompt section that points at it. An empty diff stops the run.
 */
export function runGitDiff(config: GitDiffConfig, input: GitDiffInput, deps: GitDiffDeps = {}): string {
  const getDiff = deps.getDiff ?? getWorkingTreeDiff;
  const writeDiff = deps.writeDiff ?? writeDiffFile;
  const resolveBase = deps.resolveBase ?? resolveDiffBase;

  const base = resolveBase(input.since, input.repoRoot, config, deps.runner);
  const diff = getDiff(base, input.repoRoot);
  if (diff.trim() === '') {
    (deps.removeDiff ?? removeDiffFile)(input.repoRoot, config.diffFile);
    // Only for the default base: with an explicit --since the user already chose where to look.
    const hint =
      input.since === undefined
        ? (deps.pendingHint ?? pendingSinceHint)(input.repoRoot, config, deps.runner)
        : undefined;
    const message = `nenhuma mudança em relação a ${base}.`;
    throw new Error(hint === undefined ? message : `${message} ${hint}`);
  }

  const diffFilePath = writeDiff(input.repoRoot, config.diffFile, diff);
  return buildWorkingTreeDiffPrompt({ diffFilePath, diff, base });
}
