import type { GitRunner } from './git-run';
import { createSpawnGitRunner } from './git-run';

export const DEFAULT_PROTECTED_BRANCHES: readonly string[] = ['master', 'develop', 'main'];
export const DEFAULT_MERGE_TARGET = 'develop';

/** Branches to switch to, in order, when the current branch is about to be deleted. */
const FALLBACK_BRANCHES: readonly string[] = ['develop', 'master'];

export interface CleanBranchesOptions {
  readonly protectedBranches?: readonly string[];
  /** Branch a local branch must already be merged into (normal or squash merge) to be deleted. */
  readonly mergeTarget?: string;
  readonly root?: string;
  readonly runner?: GitRunner;
}

export interface CleanBranchesResult {
  readonly deleted: readonly string[];
  /** Unprotected branches kept because their changes are not in `mergeTarget` yet. */
  readonly skipped: readonly string[];
  readonly switchedTo: string | undefined;
}

/**
 * Deletes (`git branch -D`) every unprotected local branch whose changes are already in
 * `mergeTarget`, either as an ancestor (normal merge) or as an equivalent squash commit. Refuses
 * to run with uncommitted changes. When the current branch is going to be deleted, checks out
 * `develop` (or `master`) first; nothing is deleted if that fails.
 */
export function cleanBranches(options: CleanBranchesOptions = {}): CleanBranchesResult {
  const protectedBranches = options.protectedBranches ?? DEFAULT_PROTECTED_BRANCHES;
  const target = options.mergeTarget ?? DEFAULT_MERGE_TARGET;
  const root = options.root ?? process.cwd();
  const runner = options.runner ?? createSpawnGitRunner();

  const git = (args: readonly string[]): string => {
    const result = runner.run(args, root);
    if (result.status !== 0) {
      throw new Error(`git ${args.join(' ')} falhou: ${result.stderr.trim()}`);
    }
    return result.stdout;
  };

  const isMerged = (name: string): boolean => {
    if (runner.run(['merge-base', '--is-ancestor', name, target], root).status === 0) {
      return true;
    }
    // Squash merge: collapse the branch into one temporary commit on top of the merge base and
    // ask `git cherry` whether an equivalent patch already exists in the target.
    const base = runner.run(['merge-base', target, name], root);
    if (base.status !== 0) {
      return false;
    }
    const squashed = git(['commit-tree', `${name}^{tree}`, '-p', base.stdout.trim(), '-m', 'git-clean squash check']);
    return git(['cherry', target, squashed.trim()]).startsWith('-');
  };

  if (git(['status', '--porcelain']).trim() !== '') {
    throw new Error('há mudanças não commitadas; faça commit ou stash antes de limpar as branches.');
  }

  const current = git(['branch', '--show-current']).trim();
  const branches = git(['branch', '--format=%(refname:short)'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (!branches.includes(target)) {
    throw new Error(`a branch "${target}" não existe localmente; não há como verificar o que já foi mergeado.`);
  }

  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const name of branches.filter((branch) => !protectedBranches.includes(branch))) {
    (isMerged(name) ? deleted : skipped).push(name);
  }

  let switchedTo: string | undefined;
  if (deleted.includes(current)) {
    switchedTo = FALLBACK_BRANCHES.find((name) => protectedBranches.includes(name) && branches.includes(name));
    if (switchedTo === undefined) {
      throw new Error(`nenhuma branch protegida para trocar antes da limpeza (${FALLBACK_BRANCHES.join(', ')}).`);
    }
    git(['checkout', switchedTo]);
  }

  for (const name of deleted) {
    git(['branch', '-D', name]);
  }
  return { deleted, skipped, switchedTo };
}
