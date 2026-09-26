import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanBranches, DEFAULT_MERGE_TARGET, DEFAULT_PROTECTED_BRANCHES } from '../../git/clean-branches';
import type { GitRunner } from '../../git/git-run';
import { makeTmpGitRepo } from '../helpers/git-repo';

function git(cwd: string, command: string): string {
  return execSync(`git ${command}`, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function localBranches(cwd: string): string[] {
  return git(cwd, 'branch --format="%(refname:short)"').split('\n').sort();
}

function commitFile(cwd: string, file: string, content: string): void {
  writeFileSync(join(cwd, file), content);
  git(cwd, `add ${file}`);
  git(cwd, `commit -m "feat: ${file}"`);
}

describe('cleanBranches', () => {
  let repo: ReturnType<typeof makeTmpGitRepo>;

  beforeEach(() => {
    repo = makeTmpGitRepo();
  });

  afterEach(() => {
    repo.cleanup();
  });

  it('deletes branches already merged into develop and keeps protected ones', () => {
    git(repo.path, 'branch master');
    git(repo.path, 'branch feat/empty');
    git(repo.path, 'checkout -b feat/merged');
    commitFile(repo.path, 'a.txt', 'a\n');
    git(repo.path, 'checkout develop');
    git(repo.path, 'merge --no-ff feat/merged -m "merge"');

    const result = cleanBranches({ root: repo.path });

    expect(result).toEqual({ deleted: ['feat/empty', 'feat/merged'], skipped: [], switchedTo: undefined });
    expect(localBranches(repo.path)).toEqual(['develop', 'master']);
  });

  it('detects squash merges', () => {
    git(repo.path, 'checkout -b feat/squashed');
    commitFile(repo.path, 'a.txt', 'a\n');
    commitFile(repo.path, 'b.txt', 'b\n');
    git(repo.path, 'checkout develop');
    git(repo.path, 'merge --squash feat/squashed');
    git(repo.path, 'commit -m "feat: squashed (#1)"');

    expect(cleanBranches({ root: repo.path }).deleted).toEqual(['feat/squashed']);
    expect(localBranches(repo.path)).toEqual(['develop']);
  });

  it('keeps branches with changes that are not in develop', () => {
    git(repo.path, 'checkout -b feat/pending');
    commitFile(repo.path, 'a.txt', 'a\n');
    git(repo.path, 'checkout develop');

    const result = cleanBranches({ root: repo.path });

    expect(result).toEqual({ deleted: [], skipped: ['feat/pending'], switchedTo: undefined });
    expect(localBranches(repo.path)).toEqual(['develop', 'feat/pending']);
  });

  it('keeps branches with no history in common with develop', () => {
    git(repo.path, 'checkout --orphan feat/orphan');
    commitFile(repo.path, 'a.txt', 'a\n');
    git(repo.path, 'checkout develop');

    expect(cleanBranches({ root: repo.path }).skipped).toEqual(['feat/orphan']);
  });

  it('refuses to run with uncommitted changes', () => {
    git(repo.path, 'checkout -b feat/current');
    writeFileSync(join(repo.path, 'wip.txt'), 'wip\n');

    expect(() => cleanBranches({ root: repo.path })).toThrow('há mudanças não commitadas');
    expect(localBranches(repo.path)).toEqual(['develop', 'feat/current']);
  });

  it('switches to develop before deleting the current branch when it is merged', () => {
    git(repo.path, 'checkout -b feat/current');

    const result = cleanBranches({ root: repo.path });

    expect(result).toEqual({ deleted: ['feat/current'], skipped: [], switchedTo: 'develop' });
    expect(git(repo.path, 'branch --show-current')).toBe('develop');
  });

  it('stays on the current branch when it is not merged', () => {
    git(repo.path, 'checkout -b feat/current');
    commitFile(repo.path, 'a.txt', 'a\n');

    const result = cleanBranches({ root: repo.path });

    expect(result).toEqual({ deleted: [], skipped: ['feat/current'], switchedTo: undefined });
    expect(git(repo.path, 'branch --show-current')).toBe('feat/current');
  });

  it('falls back to master when develop does not exist', () => {
    git(repo.path, 'branch -m develop master');
    git(repo.path, 'checkout -b feat/current');

    const result = cleanBranches({ root: repo.path, mergeTarget: 'master' });

    expect(result).toEqual({ deleted: ['feat/current'], skipped: [], switchedTo: 'master' });
    expect(localBranches(repo.path)).toEqual(['master']);
  });

  it('throws when the merge target does not exist locally', () => {
    expect(() => cleanBranches({ root: repo.path, mergeTarget: 'release' })).toThrow(
      'a branch "release" não existe localmente',
    );
  });

  it('throws and deletes nothing when there is no protected branch to switch to', () => {
    git(repo.path, 'branch release');
    git(repo.path, 'checkout -b feat/current');

    expect(() => cleanBranches({ root: repo.path, protectedBranches: ['release'], mergeTarget: 'release' })).toThrow(
      'nenhuma branch protegida para trocar',
    );
    expect(localBranches(repo.path)).toEqual(['develop', 'feat/current', 'release']);
  });

  it('respects custom protected branches', () => {
    git(repo.path, 'branch release');
    git(repo.path, 'branch main');

    const result = cleanBranches({ root: repo.path, protectedBranches: ['develop', 'release'] });

    expect(result.deleted).toEqual(['main']);
    expect(localBranches(repo.path)).toEqual(['develop', 'release']);
  });

  it('protects master, develop and main and checks merges against develop by default', () => {
    expect(DEFAULT_PROTECTED_BRANCHES).toEqual(['master', 'develop', 'main']);
    expect(DEFAULT_MERGE_TARGET).toBe('develop');
  });

  it('throws with the git stderr when a command fails', () => {
    const runner: GitRunner = {
      run: () => ({ stdout: '', stderr: 'fatal: not a git repository\n', status: 128 }),
    };

    expect(() => cleanBranches({ root: '/repo', runner })).toThrow(
      'git status --porcelain falhou: fatal: not a git repository',
    );
  });

  it('runs in the current working directory with default options', () => {
    git(repo.path, 'branch feat/a');
    const previous = process.cwd();
    process.chdir(repo.path);
    try {
      expect(cleanBranches()).toEqual({ deleted: ['feat/a'], skipped: [], switchedTo: undefined });
    } finally {
      process.chdir(previous);
    }
    expect(localBranches(repo.path)).toEqual(['develop']);
  });
});
