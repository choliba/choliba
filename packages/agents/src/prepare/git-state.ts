import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { DEFAULT_DIFF_BASE, createSpawnGitRunner, type GitRunner } from '@choliba/core/git';

import { SINCE_PENDING } from './constants';

/** What `git_diff` needs to pick its base: the default, and where the last run is recorded (`--pending`). */
export interface DiffBaseConfig {
  readonly defaultBase: string;
  /** `undefined` when the agent's `git_diff` has no `--pending`: then `--since pending` is an error. */
  readonly sincePendingState: string | undefined;
}

export function readGitState(repoRoot: string, stateFile: string): string | null {
  const absolute = join(repoRoot, stateFile);
  if (!existsSync(absolute)) {
    return null;
  }
  const content = readFileSync(absolute, 'utf8').trim();
  return content === '' ? null : content;
}

export function writeGitState(repoRoot: string, stateFile: string, sha: string): void {
  const absolute = join(repoRoot, stateFile);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${sha}\n`, 'utf8');
}

export function getHeadCommit(
  repoRoot: string,
  runner: GitRunner = createSpawnGitRunner(),
): string {
  const result = runner.run(['rev-parse', 'HEAD'], repoRoot);
  if (result.status !== 0) {
    throw new Error(`git rev-parse HEAD falhou: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

export function resolveDiffBase(
  since: string | undefined,
  repoRoot: string,
  config: DiffBaseConfig,
  runner: GitRunner = createSpawnGitRunner(),
): string {
  if (since === undefined) {
    return config.defaultBase;
  }
  if (since === SINCE_PENDING) {
    if (config.sincePendingState === undefined) {
      throw new Error('--since pending precisa de "--pending <arquivo>" no git_diff do agente.');
    }
    const last = readGitState(repoRoot, config.sincePendingState);
    if (last === null) {
      throw new Error(
        `nenhuma execução anterior registrada — use sem --since (diff contra ${config.defaultBase}) ou --since HEAD~1 para o último commit.`,
      );
    }
    return last;
  }
  const verify = runner.run(['rev-parse', '--verify', '--quiet', `${since}^{commit}`], repoRoot);
  if (verify.status !== 0) {
    throw new Error(`a referência "${since}" não existe neste repositório.`);
  }
  return since;
}

/**
 * When the default base has nothing to document, points at `--since pending` if the last recorded
 * run is behind HEAD — the usual case right after the work was merged into the default base.
 */
export function pendingSinceHint(
  repoRoot: string,
  config: Pick<DiffBaseConfig, 'sincePendingState'>,
  runner: GitRunner = createSpawnGitRunner(),
): string | undefined {
  if (config.sincePendingState === undefined) {
    return undefined;
  }
  const last = readGitState(repoRoot, config.sincePendingState);
  if (last === null) {
    return undefined;
  }
  const result = runner.run(['rev-list', '--count', `${last}..HEAD`], repoRoot);
  const commits = Number.parseInt(result.stdout.trim(), 10);
  if (result.status !== 0 || !(commits > 0)) {
    return undefined;
  }
  return `Há ${String(commits)} commit(s) desde a última execução registrada (${last.slice(0, 7)}): rode com --since-pending para incluí-los.`;
}

/** Records HEAD as the base for a future `--since pending` run. */
export function recordGitHead(
  repoRoot: string,
  stateFile: string,
  runner: GitRunner = createSpawnGitRunner(),
): void {
  writeGitState(repoRoot, stateFile, getHeadCommit(repoRoot, runner));
}

/** Default git diff base when omitted from agent.yaml. */
export { DEFAULT_DIFF_BASE };
