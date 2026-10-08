import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { GitRunner } from '@choliba/core';
import { getWorkingTreeDiff } from '../../steps/git-working-tree-diff';
import { makeTmpGitRepo } from '../helpers/git-repo';
import { makeTmpDir } from '../helpers/tmp';

describe('getWorkingTreeDiff', () => {
  it('throws when the base ref does not exist', () => {
    const runner: GitRunner = {
      run(args) {
        if (args[0] === 'rev-parse' && args.includes('--quiet')) {
          return { stdout: '', stderr: 'bad ref', status: 1 };
        }
        throw new Error('unexpected');
      },
    };

    expect(() => getWorkingTreeDiff('develop', '/repo', [], runner)).toThrow(
      'a referência "develop" não existe neste repositório.',
    );
  });

  it('copies the real index file when it exists on disk', () => {
    const tmp = makeTmpDir('git-real-index');
    try {
      const indexPath = join(tmp.path, 'index');
      writeFileSync(indexPath, 'fake-index');

      const runner: GitRunner = {
        run(args, _root, env) {
          if (args[0] === 'rev-parse' && args.includes('--quiet')) {
            return { stdout: 'abc123', stderr: '', status: 0 };
          }
          if (args[0] === 'rev-parse' && args.includes('--git-path')) {
            return { stdout: indexPath, stderr: '', status: 0 };
          }
          if (args[0] === 'add') {
            expect(env?.['GIT_INDEX_FILE']).toBeDefined();
            return { stdout: '', stderr: '', status: 0 };
          }
          if (args[0] === 'diff') {
            return { stdout: 'diff --git a/a.ts b/a.ts\n', stderr: '', status: 0 };
          }
          throw new Error('unexpected');
        },
      };

      expect(getWorkingTreeDiff('develop', tmp.path, [], runner)).toContain('diff --git');
    } finally {
      tmp.cleanup();
    }
  });

  it('stages into a temporary index and returns cached diff output', () => {
    const calls: string[][] = [];
    const runner: GitRunner = {
      run(args, _root, env) {
        calls.push([...args]);
        if (args[0] === 'rev-parse' && args.includes('--quiet')) {
          return { stdout: 'abc123', stderr: '', status: 0 };
        }
        if (args[0] === 'rev-parse' && args.includes('--git-path')) {
          return { stdout: '/repo/.git/index', stderr: '', status: 0 };
        }
        if (args[0] === 'add') {
          expect(env?.['GIT_INDEX_FILE']).toBeDefined();
          return { stdout: '', stderr: '', status: 0 };
        }
        if (args[0] === 'diff') {
          expect(env?.['GIT_INDEX_FILE']).toBeDefined();
          expect(args).toContain('develop');
          expect(args).toContain(':(exclude)trash');
          return { stdout: 'diff --git a/a.ts b/a.ts\n', stderr: '', status: 0 };
        }
        throw new Error(`unexpected: ${args.join(' ')}`);
      },
    };

    expect(getWorkingTreeDiff('develop', '/repo', ['trash'], runner)).toBe('diff --git a/a.ts b/a.ts\n');
    expect(calls.some((args) => args[0] === 'add')).toBe(true);
    expect(calls.some((args) => args[0] === 'diff')).toBe(true);
  });

  it('surfaces git add failures', () => {
    const runner: GitRunner = {
      run(args) {
        if (args[0] === 'rev-parse' && args.includes('--quiet')) {
          return { stdout: 'abc123', stderr: '', status: 0 };
        }
        if (args[0] === 'rev-parse' && args.includes('--git-path')) {
          return { stdout: '/missing/index', stderr: '', status: 0 };
        }
        if (args[0] === 'add') {
          return { stdout: '', stderr: 'add failed', status: 1 };
        }
        throw new Error('unexpected');
      },
    };

    expect(() => getWorkingTreeDiff('develop', '/repo', [], runner)).toThrow('git add falhou: add failed');
  });

  it('uses default excludes and runner against a repo with a local develop ref', () => {
    const tmp = makeTmpGitRepo({ dirty: true });
    try {
      const diff = getWorkingTreeDiff('develop', tmp.path);
      expect(diff.trim()).not.toBe('');
      expect(diff).toContain('untracked.txt');
    } finally {
      tmp.cleanup();
    }
  });

  it('surfaces git diff failures', () => {
    const runner: GitRunner = {
      run(args) {
        if (args[0] === 'rev-parse' && args.includes('--quiet')) {
          return { stdout: 'abc123', stderr: '', status: 0 };
        }
        if (args[0] === 'rev-parse' && args.includes('--git-path')) {
          return { stdout: '/missing/index', stderr: '', status: 0 };
        }
        if (args[0] === 'add') {
          return { stdout: '', stderr: '', status: 0 };
        }
        if (args[0] === 'diff') {
          return { stdout: '', stderr: 'diff failed', status: 1 };
        }
        throw new Error('unexpected');
      },
    };

    expect(() => getWorkingTreeDiff('develop', '/repo', [], runner)).toThrow('git diff falhou: diff failed');
  });
});
