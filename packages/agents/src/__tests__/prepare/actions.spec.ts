import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as gitDiff from '../../steps/git-working-tree-diff';

import type { StepFailure, StepSpawn } from '../../prepare/actions';
import {
  ACTIONS,
  StepFailedError,
  checkStep,
  describeStep,
  findAction,
  formatStepFailure,
  previewBeforeSteps,
  runAfterSteps,
  runBeforeSteps,
  stepExitCode,
} from '../../prepare/actions';
import { readGitState } from '../../prepare/git-state';
import { makeTmpGitRepo } from '../helpers/git-repo';
import { makeTmpDir } from '../helpers/tmp';

function recordingSpawn(status: number | null = 0, stderr = '', stdout = ''): StepSpawn & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const spawn = (command: string, args: readonly string[], options: object) => {
    calls.push([command, args, options]);
    return { status, stdout, stderr };
  };
  return Object.assign(spawn, { calls });
}

/** The failure `action` throws, as `StepFailedError` carries it. */
function failureOf(action: () => unknown): StepFailure {
  try {
    action();
  } catch (error) {
    if (error instanceof StepFailedError) {
      return error.failure;
    }
    throw error;
  }
  throw new Error('expected a StepFailedError');
}

describe('findAction', () => {
  it('finds registered actions only, not inherited object keys', () => {
    expect(findAction('run')).toBe(ACTIONS['run']);
    expect(findAction('toString')).toBeUndefined();
  });
});

describe('checkStep', () => {
  it('accepts a known action, in an allowed list, with fitting arguments', () => {
    expect(checkStep({ action: 'record_git_head', args: ['a'] }, 'after_execute')).toEqual({
      action: ACTIONS['record_git_head'],
    });
  });

  it('names an unknown action, a wrong list and wrong arguments', () => {
    expect(checkStep({ action: 'nope', args: [] }, 'after_execute')).toEqual({
      error: 'ação desconhecida "nope" (esperado: run, git_diff, add_files, record_git_head)',
    });
    expect(checkStep({ action: 'git_diff', args: ['a', 'b'] }, 'after_execute')).toEqual({
      error: '"git_diff" não pode ser usado em after_execute',
    });
    expect(checkStep({ action: 'add_files', args: ['tag'] }, 'before_execute')).toEqual({
      error: 'esperado "add_files <tag> <glob...>"',
    });
  });
});

describe('runBeforeSteps', () => {
  it('collects the prompt sections of the actions, in order', () => {
    const tmp = makeTmpDir('actions-sections');
    const getDiff = jest.spyOn(gitDiff, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
    try {
      writeFileSync(join(tmp.path, 'README.md'), '# Hi\n');
      const spawn = recordingSpawn();
      const sections = runBeforeSteps(
        { repoRoot: tmp.path, since: undefined, spawn },
        [
          { action: 'git_diff', args: ['develop', '.cache/x/diff.patch'] },
          { action: 'run', args: ['bun', 'x', 'check'] },
          { action: 'add_files', args: ['readme_atual', 'README.md'] },
        ],
        'execute.before',
      );

      expect(sections).toHaveLength(2);
      expect(sections[0]).toContain('.cache/x/diff.patch');
      expect(sections[1]).toBe('<readme_atual>\n\n### README.md\n\n# Hi\n\n\n</readme_atual>');
      expect(spawn.calls).toEqual([['bun', ['x', 'check'], { cwd: tmp.path, encoding: 'utf8', shell: false }]]);
    } finally {
      getDiff.mockRestore();
      tmp.cleanup();
    }
  });

  it('stops at the first failing command, with its position, status and the end of its output', () => {
    const spawn = recordingSpawn(2, '[error] bad\n', 'checking\n');
    const steps = [
      { action: 'run', args: ['bun', 'x', 'prettier'] },
      { action: 'run', args: ['never', 'runs'] },
    ];

    expect(
      failureOf(() => runBeforeSteps({ repoRoot: '/repo', since: undefined, spawn }, steps, 'plan.before')),
    ).toEqual({
      label: 'plan.before 1/2',
      step: steps[0],
      status: 2,
      output: 'checking\n[error] bad',
    });
    expect(spawn.calls).toHaveLength(1);
  });

  it('keeps only the last lines of a long output', () => {
    const spawn = recordingSpawn(1, Array.from({ length: 30 }, (_, index) => `line ${String(index)}`).join('\n'));
    const { output } = failureOf(() =>
      runBeforeSteps(
        { repoRoot: '/repo', since: undefined, spawn },
        [{ action: 'run', args: ['x'] }],
        'execute.before',
      ),
    );

    expect(output.split('\n')).toHaveLength(20);
    expect(output.startsWith('line 10')).toBe(true);
  });

  it('has no status for a command a signal ended, nor for an action that is not a command', () => {
    const killed = recordingSpawn(null);
    expect(
      failureOf(() =>
        runBeforeSteps({ repoRoot: '/r', since: undefined, spawn: killed }, [{ action: 'run', args: ['x'] }], 'b'),
      ).status,
    ).toBeUndefined();
    expect(
      failureOf(() =>
        runBeforeSteps({ repoRoot: '/r', since: undefined }, [{ action: 'add_files', args: ['t'] }], 'b'),
      ),
    ).toEqual({
      label: 'b 1/1',
      step: { action: 'add_files', args: ['t'] },
      status: undefined,
      output: 'esperado "add_files <tag> <glob...>"',
    });
  });

  it('turns an error an action throws into its output', () => {
    const failure = failureOf(() =>
      runBeforeSteps(
        { repoRoot: '/r', since: undefined },
        [{ action: 'git_diff', args: ['a', 'b', '--pending'] }],
        'b',
      ),
    );

    expect(failure.output).toBe('esperado "git_diff <base> <arquivo> [--pending <estado>]"');
  });

  it('takes the message of an error an action throws as its output, with no status', () => {
    const tmp = makeTmpDir('actions-not-a-repo');
    try {
      const [failure] = runAfterSteps(
        { repoRoot: tmp.path, since: undefined },
        [{ action: 'record_git_head', args: ['.cache/x/last-base'] }],
        'execute.after.success',
      );

      expect(failure?.status).toBeUndefined();
      expect(failure?.output).not.toMatch(/^Error: /);
      expect(failure?.output).not.toBe('');
    } finally {
      tmp.cleanup();
    }
  });

  it('runs real commands by default', () => {
    expect(
      runBeforeSteps({ repoRoot: process.cwd(), since: undefined }, [{ action: 'run', args: ['true'] }], 'b'),
    ).toEqual([]);
  });
});

describe('runAfterSteps', () => {
  it('runs every step, even after one fails, and returns the ones that failed', () => {
    const repo = makeTmpGitRepo();
    try {
      const spawn = recordingSpawn(3, 'boom');
      const failures = runAfterSteps(
        { repoRoot: repo.path, since: undefined, spawn },
        [
          { action: 'run', args: ['bun', 'x', 'prettier'] },
          { action: 'record_git_head', args: ['.cache/x/last-base'] },
          { action: 'git_diff', args: ['a', 'b'] },
        ],
        'execute.after.success',
      );

      expect(failures).toEqual([
        {
          label: 'execute.after.success 1/3',
          step: { action: 'run', args: ['bun', 'x', 'prettier'] },
          status: 3,
          output: 'boom',
        },
        {
          label: 'execute.after.success 3/3',
          step: { action: 'git_diff', args: ['a', 'b'] },
          status: undefined,
          output: '"git_diff" não pode ser usado em after_execute',
        },
      ]);
      expect(readGitState(repo.path, '.cache/x/last-base')).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      repo.cleanup();
    }
  });
});

describe('previewBeforeSteps', () => {
  it('marks where each step that adds to the prompt would put what it produces', () => {
    expect(
      previewBeforeSteps(
        [
          { action: 'run', args: ['x'] },
          { action: 'add_files', args: ['falhas_red', 'red.md'] },
          { action: 'nope', args: [] },
        ],
        'execute.before',
      ),
    ).toEqual(['[execute.before 2/3 — add_files: falhas_red red.md: produzido aqui na execução real]']);
  });
});

describe('formatStepFailure / stepExitCode / describeStep', () => {
  const step = { action: 'run', args: ['bunx', 'choliba', 'tests', 'tt:TT-1', '--expect', 'red'] };

  it('says which step failed, what it ran, its status and the end of its output', () => {
    expect(formatStepFailure({ label: 'execute.before 1/2', step, status: 2, output: 'CA-01 falhou\nfim' })).toBe(
      [
        '✗ execute.before 1/2 falhou — run: bunx choliba tests tt:TT-1 --expect red (código 2)',
        '  CA-01 falhou',
        '  fim',
      ].join('\n'),
    );
    expect(formatStepFailure({ label: 'b 1/1', step, status: undefined, output: '' })).toBe(
      '✗ b 1/1 falhou — run: bunx choliba tests tt:TT-1 --expect red',
    );
  });

  it('ends a run with the status of the command, else 1', () => {
    expect(stepExitCode({ label: 'l', step, status: 4, output: '' })).toBe(4);
    expect(stepExitCode({ label: 'l', step, status: undefined, output: '' })).toBe(1);
  });

  it('writes a step as it is in agent.yaml', () => {
    expect(describeStep({ action: 'add_files', args: ['t', 'a.md'] })).toBe('add_files: t a.md');
  });
});

describe('ACTIONS', () => {
  it('rejects a direct call with a missing argument', () => {
    const context = { repoRoot: '/repo', since: undefined };

    expect(() => ACTIONS['record_git_head']?.run(context, [])).toThrow('argumento faltando: record_git_head <arquivo>');
    expect(() => ACTIONS['run']?.run(context, [])).toThrow('argumento faltando: run <comando> [args...]');
    expect(() => ACTIONS['add_files']?.run(context, [])).toThrow('argumento faltando: add_files <tag> <glob...>');
    expect(() => ACTIONS['git_diff']?.run(context, ['a'])).toThrow(
      'argumentos inválidos: git_diff <base> <arquivo> [--pending <estado>]',
    );
  });
});
