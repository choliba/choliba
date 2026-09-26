import type { GitRunner } from '../../git/git-run';
import {
  cleanBranches,
  collectDocsSnapshot,
  createSpawnGitRunner,
  DEFAULT_DIFF_BASE,
  DEFAULT_DIFF_EXCLUDES,
  DEFAULT_MERGE_TARGET,
  DEFAULT_PROTECTED_BRANCHES,
  getWorkingTreeDiff,
  indexDiff,
} from '../../git/index';

describe('git barrel exports', () => {
  it('re-exports the public git helpers', () => {
    expect(DEFAULT_DIFF_BASE).toBe('develop');
    expect(DEFAULT_DIFF_EXCLUDES).toEqual(['trash', 'plans', '.cache']);
    expect(indexDiff('')).toEqual([]);
    expect(DEFAULT_PROTECTED_BRANCHES).toEqual(['master', 'develop', 'main']);
    expect(DEFAULT_MERGE_TARGET).toBe('develop');
    expect(typeof cleanBranches).toBe('function');
    expect(createSpawnGitRunner().run(['--version'], process.cwd()).status).toBe(0);
    expect(collectDocsSnapshot(process.cwd()).docs).toEqual(expect.any(Array));

    const runner: GitRunner = {
      run(args) {
        if (args[0] === 'rev-parse' && args.includes('--quiet')) {
          return { stdout: 'abc123', stderr: '', status: 0 };
        }
        if (args[0] === 'rev-parse' && args.includes('--git-path')) {
          return { stdout: '/repo/.git/index', stderr: '', status: 0 };
        }
        if (args[0] === 'add') {
          return { stdout: '', stderr: '', status: 0 };
        }
        if (args[0] === 'diff') {
          return { stdout: 'diff --git a/a.ts b/a.ts\n', stderr: '', status: 0 };
        }
        throw new Error(`unexpected: ${args.join(' ')}`);
      },
    };
    expect(getWorkingTreeDiff('develop', '/repo', [], runner)).toContain('diff --git');
  });
});
