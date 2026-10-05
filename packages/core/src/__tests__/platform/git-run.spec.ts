import type { GitSpawnSync } from '../../platform/git-run';
import { createSpawnGitRunner } from '../../platform/git-run';

describe('createSpawnGitRunner', () => {
  it('runs git in the given repository directory', () => {
    const runner = createSpawnGitRunner();
    const result = runner.run(['--version'], process.cwd());

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/git version/);
  });

  it('defaults to exit code 1 when spawn returns no status', () => {
    const spawnFn: GitSpawnSync = () => ({ stdout: '', stderr: 'fail', status: null });

    const runner = createSpawnGitRunner(spawnFn);
    expect(runner.run(['status'], '/repo')).toEqual({ stdout: '', stderr: 'fail', status: 1 });
  });
});
