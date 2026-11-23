/**
 * Local branches already merged into `develop`: finds them and deletes them.
 * The logic of `bun run git:clean` (scripts/git-clean.ts), apart so a test can
 * run it in a repository of its own.
 */

import { runProgram } from '../src/execute/process';

/** Branches that stay whatever happens: the two that every pull request goes through. */
const PROTECTED_BRANCHES: ReadonlySet<string> = new Set(['master', 'develop']);
/** The branch another one must already be merged into (normal merge or squash) to be deleted. */
const MERGE_TARGET = 'develop';
/** Where to switch, in order, when the current branch is about to be deleted. */
const FALLBACK_BRANCHES: readonly string[] = ['develop', 'master'];
/** Time limit of one `git` call, in milliseconds: a local repository answers at once. */
const GIT_TIMEOUT_MS = 60_000;

export interface CleanResult {
  readonly deleted: readonly string[];
  /** Branches kept because their changes are not in `develop` yet. */
  readonly skipped: readonly string[];
  /** The branch it switched to, when the current one was deleted. */
  readonly switchedTo: string | undefined;
}

/** `git -C root …`: its output, or the error when it fails. */
function git(root: string, args: readonly string[]): Promise<string> {
  return runProgram('git', ['-C', root, ...args], {
    timeoutMs: GIT_TIMEOUT_MS,
  });
}

/** `git -C root …` as a yes or no: whether it ended with exit code 0. */
async function succeeds(
  root: string,
  args: readonly string[],
): Promise<boolean> {
  try {
    await git(root, args);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the branch's changes are in `develop`: as an ancestor (normal
 * merge) or as an equivalent commit (squash). For the squash, the branch
 * becomes one temporary commit over the merge base, and `git cherry` says
 * whether a patch like it already exists in `develop`.
 */
async function isMerged(root: string, name: string): Promise<boolean> {
  if (await succeeds(root, ['merge-base', '--is-ancestor', name, MERGE_TARGET]))
    return true;
  let base: string;
  try {
    base = (await git(root, ['merge-base', MERGE_TARGET, name])).trim();
  } catch {
    return false;
  }
  const squashed = (
    await git(root, [
      'commit-tree',
      `${name}^{tree}`,
      '-p',
      base,
      '-m',
      'git-clean squash check',
    ])
  ).trim();
  return (await git(root, ['cherry', MERGE_TARGET, squashed])).startsWith('-');
}

/**
 * Deletes (`git branch -D`) every local branch, except `master` and
 * `develop`, whose changes are already in `develop`. Refuses to run with
 * uncommitted changes. When the current branch is about to go, switches to
 * `develop` (or `master`) first; nothing is deleted if that fails.
 */
export async function cleanBranches(root: string): Promise<CleanResult> {
  if ((await git(root, ['status', '--porcelain'])).trim() !== '') {
    throw new Error(
      'há mudanças não commitadas; faça commit ou stash antes de limpar as branches.',
    );
  }

  const current = (await git(root, ['branch', '--show-current'])).trim();
  const branches = (await git(root, ['branch', '--format=%(refname:short)']))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (!branches.includes(MERGE_TARGET)) {
    throw new Error(
      `a branch "${MERGE_TARGET}" não existe localmente; não há como verificar o que já foi mergeado.`,
    );
  }

  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const name of branches.filter(
    (branch) => !PROTECTED_BRANCHES.has(branch),
  )) {
    ((await isMerged(root, name)) ? deleted : skipped).push(name);
  }

  let switchedTo: string | undefined;
  if (deleted.includes(current)) {
    switchedTo = FALLBACK_BRANCHES.find((name) => branches.includes(name));
    if (switchedTo === undefined) {
      throw new Error(
        `nenhuma branch protegida para trocar antes da limpeza (${FALLBACK_BRANCHES.join(', ')}).`,
      );
    }
    await git(root, ['checkout', switchedTo]);
  }

  for (const name of deleted) await git(root, ['branch', '-D', name]);
  return { deleted, skipped, switchedTo };
}
