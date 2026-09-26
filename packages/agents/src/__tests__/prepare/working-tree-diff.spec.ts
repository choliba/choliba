import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as coreGit from '@choliba/core/git';

import {
  buildWorkingTreeDiffPrompt,
  parseGitDiffArgs,
  removeDiffFile,
  runGitDiff,
  writeDiffFile,
} from '../../prepare/working-tree-diff';
import { makeTmpDir } from '../helpers/tmp';

const TEST_DIFF_FILE = '.cache/test-agent/diff.patch';

const CONFIG = {
  defaultBase: 'develop',
  diffFile: TEST_DIFF_FILE,
  sincePendingState: '.cache/test-agent/last-base',
};

describe('parseGitDiffArgs', () => {
  it('reads base and file, with or without --pending', () => {
    expect(parseGitDiffArgs(['develop', 'd.patch'])).toEqual({
      defaultBase: 'develop',
      diffFile: 'd.patch',
      sincePendingState: undefined,
    });
    expect(parseGitDiffArgs(['develop', 'd.patch', '--pending', 'last'])).toEqual({
      defaultBase: 'develop',
      diffFile: 'd.patch',
      sincePendingState: 'last',
    });
  });

  it.each([[[]], [['develop']], [['develop', 'd.patch', '--pending']], [['develop', 'd.patch', '--other', 'x']]])(
    'rejects %j',
    (args) => {
      expect(parseGitDiffArgs(args)).toBeUndefined();
    },
  );
});

describe('buildWorkingTreeDiffPrompt', () => {
  it('points at the diff file and indexes it', () => {
    const prompt = buildWorkingTreeDiffPrompt({
      diffFilePath: TEST_DIFF_FILE,
      diff: 'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n',
      base: 'develop',
    });

    expect(prompt).toContain(`\`${TEST_DIFF_FILE}\``);
    expect(prompt).toContain('base `develop`');
    expect(prompt).toContain('M a.ts');
  });
});

describe('runGitDiff', () => {
  const input = { repoRoot: '/repo', since: undefined };

  it('rejects an empty diff', () => {
    expect(() => runGitDiff(CONFIG, input, { getDiff: () => '   \n', removeDiff: () => undefined })).toThrow(
      'nenhuma mudança em relação a develop',
    );
  });

  it('removes the diff of an earlier run when there are no changes now', () => {
    const tmp = makeTmpDir('git-diff-stale');
    try {
      writeDiffFile(tmp.path, TEST_DIFF_FILE, 'diff --git a/old.ts b/old.ts\n');

      expect(() =>
        runGitDiff(CONFIG, { repoRoot: tmp.path, since: undefined }, { getDiff: () => '', pendingHint: () => undefined }),
      ).toThrow(/^nenhuma mudança em relação a develop\.$/);
      expect(existsSync(join(tmp.path, TEST_DIFF_FILE))).toBe(false);

      removeDiffFile(tmp.path, TEST_DIFF_FILE);
      expect(existsSync(join(tmp.path, TEST_DIFF_FILE))).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('suggests --since pending only for the default base', () => {
    const pendingHint = jest.fn(() => 'Há 3 commit(s) desde a última execução registrada (abc1234).');
    const removeDiff = () => undefined;

    expect(() => runGitDiff(CONFIG, input, { getDiff: () => '', pendingHint, removeDiff })).toThrow(
      'nenhuma mudança em relação a develop. Há 3 commit(s) desde a última execução registrada (abc1234).',
    );
    expect(() =>
      runGitDiff(
        CONFIG,
        { ...input, since: 'HEAD~1' },
        { getDiff: () => '', resolveBase: () => 'HEAD~1', pendingHint, removeDiff },
      ),
    ).toThrow(/^nenhuma mudança em relação a HEAD~1\.$/);
    expect(pendingHint).toHaveBeenCalledTimes(1);
  });

  it('uses --since to choose the diff base', () => {
    const getDiff = jest.fn(() => 'diff --git a/a.ts b/a.ts\n');
    runGitDiff(
      CONFIG,
      { ...input, since: 'HEAD~1' },
      { getDiff, resolveBase: () => 'HEAD~1', writeDiff: () => TEST_DIFF_FILE },
    );

    expect(getDiff).toHaveBeenCalledWith('HEAD~1', '/repo');
  });

  it('writes the diff and returns the prompt section with the default dependencies', () => {
    const getDiff = jest.spyOn(coreGit, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
    const tmp = makeTmpDir('git-diff-default-deps');
    try {
      const section = runGitDiff(CONFIG, { repoRoot: tmp.path, since: undefined });

      expect(getDiff).toHaveBeenCalledWith('develop', tmp.path);
      expect(section).toContain(TEST_DIFF_FILE);
      expect(readFileSync(join(tmp.path, TEST_DIFF_FILE), 'utf8')).toBe('diff --git a/a.ts b/a.ts\n');
    } finally {
      tmp.cleanup();
      getDiff.mockRestore();
    }
  });
});

describe('writeDiffFile', () => {
  it('writes the patch under the configured path', () => {
    const tmp = makeTmpDir('prepare-write');
    try {
      const relative = writeDiffFile(tmp.path, TEST_DIFF_FILE, 'patch-body\n');
      expect(relative).toBe(TEST_DIFF_FILE);
      expect(readFileSync(join(tmp.path, relative), 'utf8')).toBe('patch-body\n');
    } finally {
      tmp.cleanup();
    }
  });
});
