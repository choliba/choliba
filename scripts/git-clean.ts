/** Apaga branches locais já mergeadas em develop, preservando master e develop. */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const PROTECTED_BRANCHES: readonly string[] = ['master', 'develop'];
/** Branch a local branch must already be merged into (normal or squash merge) to be deleted. */
const MERGE_TARGET = 'develop';
/** Branches to switch to, in order, when the current branch is about to be deleted. */
const FALLBACK_BRANCHES: readonly string[] = ['develop', 'master'];

const repoRoot = join(import.meta.dirname, '..');

interface GitResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
}

function run(args: readonly string[]): GitResult {
  const result = spawnSync('git', [...args], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status ?? 1 };
}

function git(args: readonly string[]): string {
  const result = run(args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} falhou: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function isMerged(name: string): boolean {
  if (run(['merge-base', '--is-ancestor', name, MERGE_TARGET]).status === 0) {
    return true;
  }
  // Squash merge: collapse the branch into one temporary commit on top of the merge base and
  // ask `git cherry` whether an equivalent patch already exists in the target.
  const base = run(['merge-base', MERGE_TARGET, name]);
  if (base.status !== 0) {
    return false;
  }
  const squashed = git(['commit-tree', `${name}^{tree}`, '-p', base.stdout.trim(), '-m', 'git-clean squash check']);
  return git(['cherry', MERGE_TARGET, squashed.trim()]).startsWith('-');
}

interface CleanResult {
  readonly deleted: readonly string[];
  /** Unprotected branches kept because their changes are not in `MERGE_TARGET` yet. */
  readonly skipped: readonly string[];
  readonly switchedTo: string | undefined;
}

/**
 * Deletes (`git branch -D`) every unprotected local branch whose changes are already in
 * `MERGE_TARGET`, either as an ancestor (normal merge) or as an equivalent squash commit. Refuses
 * to run with uncommitted changes. When the current branch is going to be deleted, checks out
 * `develop` (or `master`) first; nothing is deleted if that fails.
 */
function cleanBranches(): CleanResult {
  if (git(['status', '--porcelain']).trim() !== '') {
    throw new Error('há mudanças não commitadas; faça commit ou stash antes de limpar as branches.');
  }

  const current = git(['branch', '--show-current']).trim();
  const branches = git(['branch', '--format=%(refname:short)'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  if (!branches.includes(MERGE_TARGET)) {
    throw new Error(`a branch "${MERGE_TARGET}" não existe localmente; não há como verificar o que já foi mergeado.`);
  }

  const deleted: string[] = [];
  const skipped: string[] = [];
  for (const name of branches.filter((branch) => !PROTECTED_BRANCHES.includes(branch))) {
    (isMerged(name) ? deleted : skipped).push(name);
  }

  let switchedTo: string | undefined;
  if (deleted.includes(current)) {
    switchedTo = FALLBACK_BRANCHES.find((name) => branches.includes(name));
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

console.log('🧹 Limpando branches locais já mergeadas em develop (mantendo master e develop)...');
console.log('   Dica: rode `git pull` em develop antes, senão branches recém-mergeadas ficam de fora.');

try {
  const { deleted, skipped, switchedTo } = cleanBranches();
  if (switchedTo !== undefined) {
    console.log(`🔀 Trocado para ${switchedTo}`);
  }
  for (const name of deleted) {
    console.log(`🗑️  ${name}`);
  }
  for (const name of skipped) {
    console.log(`⏭️  ${name} (não mergeada em develop, mantida)`);
  }
  console.log(deleted.length === 0 ? '✨ Nada para limpar.' : `✅ ${String(deleted.length)} branch(es) removida(s).`);
} catch (error) {
  console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
