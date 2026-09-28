import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as coreGit from '@choliba/core/git';

import type { StepSpawn } from '../../prepare/actions';
import { ACTIONS, checkStep, findAction, runSteps } from '../../prepare/actions';
import { readGitState } from '../../prepare/git-state';
import { makeTmpGitRepo } from '../helpers/git-repo';
import { makeTmpDir } from '../helpers/tmp';

function recordingSpawn(status = 0, stderr = ''): StepSpawn & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const spawn = (command: string, args: readonly string[], options: object) => {
    calls.push([command, args, options]);
    return { status, stderr };
  };
  return Object.assign(spawn, { calls });
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

describe('runSteps', () => {
  it('runs commands without a shell, from the repo root, and calls methods in order with them', () => {
    const repo = makeTmpGitRepo();
    try {
      const spawn = recordingSpawn();
      const sections = runSteps(
        { repoRoot: repo.path, since: undefined, spawn },
        [
          { action: 'run', args: ['bun', 'x', 'prettier'] },
          { action: 'record_git_head', args: ['.cache/x/last-base'] },
        ],
        'after_execute',
      );

      expect(sections).toEqual([]);
      expect(spawn.calls).toEqual([['bun', ['x', 'prettier'], { cwd: repo.path, encoding: 'utf8', shell: false }]]);
      expect(readGitState(repo.path, '.cache/x/last-base')).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      repo.cleanup();
    }
  });

  it('collects the prompt sections of before_execute actions', () => {
    const tmp = makeTmpDir('actions-sections');
    const getDiff = jest.spyOn(coreGit, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
    try {
      writeFileSync(join(tmp.path, 'README.md'), '# Hi\n');
      const sections = runSteps(
        { repoRoot: tmp.path, since: undefined },
        [
          { action: 'git_diff', args: ['develop', '.cache/x/diff.patch'] },
          { action: 'add_files', args: ['readme_atual', 'README.md'] },
        ],
        'before_execute',
      );

      expect(sections).toHaveLength(2);
      expect(sections[0]).toContain('.cache/x/diff.patch');
      expect(sections[1]).toBe('<readme_atual>\n\n### README.md\n\n# Hi\n\n\n</readme_atual>');
    } finally {
      getDiff.mockRestore();
      tmp.cleanup();
    }
  });

  it('stops at the first failing command, naming it and its stderr', () => {
    const spawn = recordingSpawn(2, '[error] bad\n');
    const steps = [
      { action: 'run', args: ['bun', 'x', 'prettier'] },
      { action: 'run', args: ['never', 'runs'] },
    ];

    expect(() => runSteps({ repoRoot: '/repo', since: undefined, spawn }, steps, 'after_execute')).toThrow(
      'run "bun x prettier" falhou: [error] bad',
    );
    expect(spawn.calls).toHaveLength(1);
  });

  it('refuses a step that does not fit its list', () => {
    expect(() =>
      runSteps({ repoRoot: '/repo', since: undefined }, [{ action: 'git_diff', args: ['a', 'b'] }], 'after_execute'),
    ).toThrow('after_execute: "git_diff" não pode ser usado em after_execute');
  });

  it('runs real commands by default', () => {
    expect(() =>
      runSteps({ repoRoot: process.cwd(), since: undefined }, [{ action: 'run', args: ['true'] }], 'after_execute'),
    ).not.toThrow();
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
