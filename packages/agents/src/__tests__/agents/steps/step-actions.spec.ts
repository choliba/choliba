import { existsSync, readdirSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';

import * as gitDiff from '../../../agents/steps/git-working-tree-diff';

import type { StepFailure, StepSpawn } from '../../../agents/steps/step-actions';
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
} from '../../../agents/steps/step-actions';
import { readGitState } from '../../../agents/steps/git-state';
import { makeTmpGitRepo } from '../../helpers/git-repo';
import { makeTmpDir } from '../../helpers/tmp';

/** A command that writes `chunks`, in order, to the one file its stdout and stderr go to, and exits with `status`. */
function recordingSpawn(status: number | null = 0, ...chunks: readonly string[]): StepSpawn & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const spawn: StepSpawn = (command, args, options) => {
    calls.push([
      command,
      args,
      { cwd: options.cwd, shell: options.shell, ...(options.signal ? { signal: true } : {}) },
    ]);
    for (const chunk of chunks) writeSync(options.stdio[1], chunk);
    return Promise.resolve({ status });
  };
  return Object.assign(spawn, { calls });
}

/** Where the specs keep the steps' logs. */
const LOGS = makeTmpDir('step-logs').path;

/** The failure `action` throws, as `StepFailedError` carries it. */
async function failureOf(action: () => Promise<unknown>): Promise<StepFailure> {
  try {
    await action();
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
  it('collects the prompt sections of the actions, in order', async () => {
    const tmp = makeTmpDir('actions-sections');
    const getDiff = jest.spyOn(gitDiff, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
    try {
      writeFileSync(join(tmp.path, 'README.md'), '# Hi\n');
      const spawn = recordingSpawn();
      const sections = await runBeforeSteps(
        { repoRoot: tmp.path, since: undefined, spawn, logDir: LOGS },
        [
          { action: 'git_diff', args: ['develop', '.cache/x/diff.patch'] },
          { action: 'run', args: ['bun', 'x', 'check'] },
          { action: 'add_files', args: ['readme_atual', 'README.md'] },
        ],
        'execute.before',
      );

      expect(sections).toHaveLength(2);
      expect(sections[0]).toContain('.cache/x/diff.patch');
      expect(sections[1]).toBe(
        '<readme_atual>\n\n<untrusted_input source="file:README.md">\n# Hi\n</untrusted_input>\n\n</readme_atual>',
      );
      expect(spawn.calls).toEqual([['bun', ['x', 'check'], { cwd: tmp.path, shell: false }]]);
    } finally {
      getDiff.mockRestore();
      tmp.cleanup();
    }
  });

  it('stops at the first failing command, with its position, status and the end of its output', async () => {
    const spawn = recordingSpawn(2, 'checking\n', '[error] bad\n');
    const steps = [
      { action: 'run', args: ['bun', 'x', 'prettier'] },
      { action: 'run', args: ['never', 'runs'] },
    ];

    const failure = await failureOf(() =>
      runBeforeSteps({ repoRoot: '/repo', since: undefined, spawn, logDir: LOGS }, steps, 'plan.before'),
    );
    expect(failure).toMatchObject({ label: 'plan.before 1/2', step: steps[0], status: 2 });
    const { output } = failure;
    // stdout and stderr in the order the command wrote them, then where the whole of it is.
    expect(output).toMatch(/^checking\n\[error\] bad\nsaída completa: .+\.log$/);
    const log = output.split('saída completa: ')[1] ?? '';
    expect(readFileSync(join('/repo', log), 'utf8')).toBe('checking\n[error] bad\n');
    expect(spawn.calls).toHaveLength(1);
  });

  it('keeps only the last lines of a long output, and the log the whole of it', async () => {
    const spawn = recordingSpawn(1, Array.from({ length: 30 }, (_, index) => `line ${String(index)}`).join('\n'));
    const { output } = await failureOf(() =>
      runBeforeSteps(
        { repoRoot: '/repo', since: undefined, spawn, logDir: LOGS },
        [{ action: 'run', args: ['x'] }],
        'execute.before',
      ),
    );

    expect(output.split('\n')).toHaveLength(13);
    expect(output.startsWith('line 18\n')).toBe(true);
    expect(output.split('\n').at(-1)).toMatch(/^saída completa: /);
  });

  it('leaves no log when the command succeeds, and keeps the logs in .cache/steps of the workspace by default', async () => {
    const tmp = makeTmpDir('steps-workspace');
    try {
      await runBeforeSteps(
        { repoRoot: tmp.path, since: undefined, spawn: recordingSpawn(0, 'ok') },
        [{ action: 'run', args: ['x'] }],
        'execute.before',
      );
      expect(readdirSync(join(tmp.path, '.cache', 'steps'))).toEqual([]);

      const { output } = await failureOf(() =>
        runBeforeSteps(
          { repoRoot: tmp.path, since: undefined, spawn: recordingSpawn(1) },
          [{ action: 'run', args: ['x'] }],
          'execute.before',
        ),
      );
      expect(output).toMatch(/^saída completa: \.cache\/steps\/.+\.log$/);
      expect(existsSync(join(tmp.path, output.replace('saída completa: ', '')))).toBe(true);
    } finally {
      tmp.cleanup();
    }
  });

  it('has no status for a command a signal ended, nor for an action that is not a command', async () => {
    const killed = recordingSpawn(null);
    expect(
      (
        await failureOf(() =>
          runBeforeSteps(
            { repoRoot: '/r', since: undefined, spawn: killed, logDir: LOGS },
            [{ action: 'run', args: ['x'] }],
            'b',
          ),
        )
      ).status,
    ).toBeUndefined();
    expect(
      await failureOf(() =>
        runBeforeSteps({ repoRoot: '/r', since: undefined }, [{ action: 'add_files', args: ['t'] }], 'b'),
      ),
    ).toEqual({
      label: 'b 1/1',
      step: { action: 'add_files', args: ['t'] },
      status: undefined,
      output: 'esperado "add_files <tag> <glob...>"',
    });
  });

  it('turns an error an action throws into its output', async () => {
    const failure = await failureOf(() =>
      runBeforeSteps(
        { repoRoot: '/r', since: undefined },
        [{ action: 'git_diff', args: ['a', 'b', '--pending'] }],
        'b',
      ),
    );

    expect(failure.output).toBe('esperado "git_diff <base> <arquivo> [--pending <estado>]"');
  });

  it('takes the message of an error an action throws as its output, with no status', async () => {
    const tmp = makeTmpDir('actions-not-a-repo');
    try {
      const [failure] = await runAfterSteps(
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

  it('runs real commands by default', async () => {
    expect(
      await runBeforeSteps({ repoRoot: process.cwd(), since: undefined }, [{ action: 'run', args: ['true'] }], 'b'),
    ).toEqual([]);
  });
});

describe('the run action', () => {
  it("hands the run's signal to the command, so Ctrl+C stops it", async () => {
    const spawn = recordingSpawn(0);
    const signal = new AbortController().signal;
    await runBeforeSteps(
      { repoRoot: '/repo', since: undefined, spawn, logDir: LOGS, signal },
      [{ action: 'run', args: ['x'] }],
      'b',
    );

    expect(spawn.calls).toEqual([['x', [], { cwd: '/repo', shell: false, signal: true }]]);
  });
});

describe('runAfterSteps', () => {
  it('runs every step, even after one fails, and returns the ones that failed', async () => {
    const repo = makeTmpGitRepo();
    try {
      const spawn = recordingSpawn(3, 'boom');
      const failures = await runAfterSteps(
        { repoRoot: repo.path, since: undefined, spawn, logDir: LOGS },
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
          output: expect.stringMatching(/^boom\nsaída completa: .+\.log$/) as unknown as string,
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
  it('rejects a direct call with a missing argument', async () => {
    const context = { repoRoot: '/repo', since: undefined };

    expect(() => ACTIONS['record_git_head']?.run(context, [])).toThrow('argumento faltando: record_git_head <arquivo>');
    await expect(ACTIONS['run']?.run(context, [])).rejects.toThrow('argumento faltando: run <comando> [args...]');
    expect(() => ACTIONS['add_files']?.run(context, [])).toThrow('argumento faltando: add_files <tag> <glob...>');
    expect(() => ACTIONS['git_diff']?.run(context, ['a'])).toThrow(
      'argumentos inválidos: git_diff <base> <arquivo> [--pending <estado>]',
    );
  });
});
