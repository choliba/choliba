import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type GitRunResult, type GitRunner, createSpawnGitRunner, CACHE_DIR } from '@choliba/core';

export const DEFAULT_DIFF_BASE = 'develop';
export const DEFAULT_DIFF_EXCLUDES = ['trash', 'plans', CACHE_DIR] as const;

function git(
  runner: GitRunner,
  args: readonly string[],
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): GitRunResult {
  return runner.run(args, root, env);
}

/**
 * Diff between `base` and the working tree, including untracked files. Uses a temporary index so
 * `git add -A` never touches the real staging area.
 */
export function getWorkingTreeDiff(
  base: string,
  root: string,
  excludes: readonly string[] = DEFAULT_DIFF_EXCLUDES,
  runner: GitRunner = createSpawnGitRunner(),
): string {
  const exists = git(runner, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], root);
  if (exists.status !== 0) {
    throw new Error(`a referência "${base}" não existe neste repositório.`);
  }

  const realIndex = git(runner, ['rev-parse', '--path-format=absolute', '--git-path', 'index'], root).stdout.trim();
  const tmp = mkdtempSync(join(tmpdir(), 'choliba-index-'));
  try {
    const tmpIndex = join(tmp, 'index');
    if (existsSync(realIndex)) {
      copyFileSync(realIndex, tmpIndex);
    }
    const env = { ...process.env, GIT_INDEX_FILE: tmpIndex };

    const added = git(runner, ['add', '-A'], root, env);
    if (added.status !== 0) {
      throw new Error(`git add falhou: ${added.stderr.trim()}`);
    }

    const pathspec = ['--', '.', ...excludes.map((entry) => `:(exclude)${entry}`)];
    const diff = git(runner, ['diff', '--cached', '-M', base, ...pathspec], root, env);
    if (diff.status !== 0) {
      throw new Error(`git diff falhou: ${diff.stderr.trim()}`);
    }
    return diff.stdout;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
