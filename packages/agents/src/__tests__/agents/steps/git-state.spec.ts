import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeTmpGitRepo } from '../../helpers/git-repo';
import { makeTmpDir } from '../../helpers/tmp';
import { SINCE_PENDING } from '../../../agents/steps/step-constants';
import { DEFAULT_DIFF_BASE } from '../../../agents/steps/git-working-tree-diff';
import {
  getHeadCommit,
  pendingSinceHint,
  readGitState,
  recordGitHead,
  resolveDiffBase,
  writeGitState,
} from '../../../agents/steps/git-state';

const TEST_STATE_FILE = '.cache/test-agent/last-base';

const PREPARE_CONFIG = {
  defaultBase: 'develop',
  sincePendingState: TEST_STATE_FILE,
} as const;

describe('DEFAULT_DIFF_BASE', () => {
  it('re-exports the core git default', () => {
    expect(DEFAULT_DIFF_BASE).toBe('develop');
  });
});

describe('resolveDiffBase', () => {
  it('defaults to develop when since is omitted', () => {
    expect(resolveDiffBase(undefined, '/repo', PREPARE_CONFIG)).toBe('develop');
  });

  it('reads pending from the git state file', () => {
    const tmp = makeTmpDir('git-state-pending');
    try {
      writeGitState(tmp.path, TEST_STATE_FILE, 'abc123def456');
      expect(resolveDiffBase(SINCE_PENDING, tmp.path, PREPARE_CONFIG)).toBe('abc123def456');
    } finally {
      tmp.cleanup();
    }
  });

  it('rejects pending when the git_diff has no --pending', () => {
    expect(() => resolveDiffBase(SINCE_PENDING, '/repo', { ...PREPARE_CONFIG, sincePendingState: undefined })).toThrow(
      '--since pending precisa de "--pending <arquivo>" no git_diff do agente.',
    );
  });

  it('rejects pending when no state file exists', () => {
    const tmp = makeTmpDir('git-state-no-pending');
    try {
      expect(() => resolveDiffBase(SINCE_PENDING, tmp.path, PREPARE_CONFIG)).toThrow(
        'nenhuma execução anterior registrada',
      );
    } finally {
      tmp.cleanup();
    }
  });

  it('validates explicit git refs', () => {
    const runner = {
      run(args: readonly string[]) {
        if (args.includes('--quiet') && args.includes('HEAD~1^{commit}')) {
          return { stdout: '', stderr: '', status: 0 };
        }
        throw new Error(`unexpected: ${args.join(' ')}`);
      },
    };
    expect(resolveDiffBase('HEAD~1', '/repo', PREPARE_CONFIG, runner)).toBe('HEAD~1');
  });

  it('rejects unknown git refs', () => {
    const runner = {
      run(args: readonly string[]) {
        if (args.includes('--quiet')) {
          return { stdout: '', stderr: 'bad ref', status: 1 };
        }
        throw new Error('unexpected');
      },
    };
    expect(() => resolveDiffBase('nope', '/repo', PREPARE_CONFIG, runner)).toThrow(
      'a referência "nope" não existe neste repositório.',
    );
  });
});

describe('readGitState / writeGitState / recordGitHead', () => {
  it('round-trips the last processed commit', () => {
    const tmp = makeTmpDir('git-state-last-base');
    try {
      expect(readGitState(tmp.path, TEST_STATE_FILE)).toBeNull();
      writeGitState(tmp.path, TEST_STATE_FILE, 'deadbeef');
      expect(readGitState(tmp.path, TEST_STATE_FILE)).toBe('deadbeef');
      expect(readFileSync(join(tmp.path, TEST_STATE_FILE), 'utf8')).toBe('deadbeef\n');
    } finally {
      tmp.cleanup();
    }
  });

  it('treats a blank state file as missing', () => {
    const tmp = makeTmpDir('git-state-blank-base');
    try {
      writeGitState(tmp.path, TEST_STATE_FILE, '');
      expect(readGitState(tmp.path, TEST_STATE_FILE)).toBeNull();
    } finally {
      tmp.cleanup();
    }
  });

  it('records HEAD via recordGitHead', () => {
    const tmp = makeTmpDir('git-state-record');
    try {
      recordGitHead(tmp.path, TEST_STATE_FILE, {
        run(args: readonly string[]) {
          if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
            return { stdout: 'cafebabe\n', stderr: '', status: 0 };
          }
          throw new Error('unexpected');
        },
      });
      expect(readGitState(tmp.path, TEST_STATE_FILE)).toBe('cafebabe');
    } finally {
      tmp.cleanup();
    }
  });

  it('uses the default git runner when recordGitHead is called without one', () => {
    const tmp = makeTmpGitRepo();
    try {
      recordGitHead(tmp.path, TEST_STATE_FILE);
      const sha = readGitState(tmp.path, TEST_STATE_FILE);
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      tmp.cleanup();
    }
  });

  it('surfaces rev-parse failures from getHeadCommit', () => {
    expect(() =>
      getHeadCommit('/repo', {
        run() {
          return { stdout: '', stderr: 'not a repo', status: 128 };
        },
      }),
    ).toThrow('git rev-parse HEAD falhou: not a repo');
  });

  it('uses the default git runner when getHeadCommit is called without one', () => {
    const tmp = makeTmpGitRepo();
    try {
      expect(getHeadCommit(tmp.path)).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('pendingSinceHint', () => {
  it('counts the commits since the recorded run on a real repository', () => {
    const repo = makeTmpGitRepo();
    try {
      recordGitHead(repo.path, TEST_STATE_FILE);
      const recorded = readGitState(repo.path, TEST_STATE_FILE) ?? '';
      expect(pendingSinceHint(repo.path, PREPARE_CONFIG)).toBeUndefined();

      execSync('git commit -q --allow-empty -m "feat: one" && git commit -q --allow-empty -m "feat: two"', {
        cwd: repo.path,
      });
      expect(pendingSinceHint(repo.path, PREPARE_CONFIG)).toBe(
        `Há 2 commit(s) desde a última execução registrada (${recorded.slice(0, 7)}): rode com --since-pending para incluí-los.`,
      );
    } finally {
      repo.cleanup();
    }
  });

  it('gives no hint without a recorded run or when git cannot count', () => {
    const tmp = makeTmpDir('pending-hint');
    try {
      expect(pendingSinceHint(tmp.path, { sincePendingState: undefined })).toBeUndefined();
      expect(pendingSinceHint(tmp.path, PREPARE_CONFIG)).toBeUndefined();

      writeGitState(tmp.path, TEST_STATE_FILE, 'deadbeef');
      const failing = { run: () => ({ stdout: '', stderr: 'bad revision', status: 128 }) };
      expect(pendingSinceHint(tmp.path, PREPARE_CONFIG, failing)).toBeUndefined();
    } finally {
      tmp.cleanup();
    }
  });
});
