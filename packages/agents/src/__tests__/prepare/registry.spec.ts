import { join } from 'node:path';

import * as coreGit from '@choliba/core/git';

import type { AgentDefinition } from '../../agent.types';
import { loadAgent } from '../../agent-loader';
import * as actionsModule from '../../prepare/actions';
import { buildAfterExecute, buildPrepare, diffBaseOf } from '../../prepare/registry';
import { readGitState } from '../../prepare/git-state';
import { makeTmpGitRepo } from '../helpers/git-repo';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

describe('buildPrepare / buildAfterExecute', () => {
  it('returns undefined for agents without hooks', async () => {
    const agent = await loadAgent(FIXTURES, 'echo');

    expect(buildPrepare(agent)).toBeUndefined();
    expect(buildAfterExecute(agent)).toBeUndefined();
  });

  it('wires the legacy prepare and after_execute of with-prepare', async () => {
    const agent = await loadAgent(FIXTURES, 'with-prepare');
    const prepare = buildPrepare(agent);
    const afterExecute = buildAfterExecute(agent);

    if (prepare === undefined || afterExecute === undefined) {
      throw new Error('expected prepare and afterExecute hooks');
    }

    const getDiff = jest.spyOn(coreGit, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
    const tmp = makeTmpDir('registry-hooks');
    try {
      const result = prepare({ task: '', repoRoot: tmp.path, agent, mode: 'execute' });
      expect(result.task).toBe('Atualize a documentação com base no contexto entregue.');
      expect(result.promptBody).toContain('.cache/with-prepare/diff.patch');
      expect(result.promptBody).toContain('<documentacao_atual>');
      expect(result.promptBody).toContain('<readme_atual>');
      expect(result.promptBody).not.toContain('Foco pedido pelo usuário');

      const gitRepo = makeTmpGitRepo();
      try {
        afterExecute(gitRepo.path);
        expect(readGitState(gitRepo.path, '.cache/with-prepare/last-base')).toMatch(/^[0-9a-f]{40}$/);
      } finally {
        gitRepo.cleanup();
      }
    } finally {
      tmp.cleanup();
      getDiff.mockRestore();
    }
  });

  it('adds the user task as focus and passes --since to the steps', async () => {
    const base = await loadAgent(FIXTURES, 'with-prepare');
    const run = jest.spyOn(actionsModule, 'runSteps').mockReturnValue(['ctx']);
    try {
      const result = buildPrepare(base)?.({ task: 'focar README', repoRoot: '/repo', agent: base, mode: 'execute', since: 'HEAD~1' });

      expect(result).toEqual({ task: 'focar README', promptBody: 'ctx\n\nFoco pedido pelo usuário: focar README' });
      expect(run).toHaveBeenCalledWith({ repoRoot: '/repo', since: 'HEAD~1' }, base.beforeExecute, 'before_execute');
    } finally {
      run.mockRestore();
    }
  });

  it('builds a prepare from default_task alone, whose prompt is the task', async () => {
    const echo = await loadAgent(FIXTURES, 'echo');
    const agent: AgentDefinition = { ...echo, defaultTask: 'padrão' };

    expect(buildPrepare(agent)?.({ task: ' ', repoRoot: '/repo', agent, mode: 'execute' })).toEqual({
      task: 'padrão',
      promptBody: 'padrão',
    });
    const { defaultTask: _unused, ...withoutDefault } = { ...agent, beforeExecute: [] };
    expect(buildPrepare(withoutDefault)?.({ task: '', repoRoot: '/repo', agent, mode: 'execute' })).toEqual({
      task: '',
      promptBody: '',
    });
  });

  it('hands the after_execute steps to runSteps', async () => {
    const base = await loadAgent(FIXTURES, 'with-prepare');
    const run = jest.spyOn(actionsModule, 'runSteps').mockReturnValue([]);
    try {
      const steps = [{ action: 'run', args: ['bun', 'x', 'prettier'] }];
      buildAfterExecute({ ...base, afterExecute: steps })?.('/repo');

      expect(run).toHaveBeenCalledWith({ repoRoot: '/repo', since: undefined }, steps, 'after_execute');
    } finally {
      run.mockRestore();
    }
  });
});

describe('diffBaseOf', () => {
  it("reads the base of the agent's git_diff", async () => {
    const agent = await loadAgent(FIXTURES, 'with-prepare');

    expect(diffBaseOf(agent)).toBe('develop');
    expect(diffBaseOf({ ...agent, beforeExecute: [{ action: 'git_diff', args: ['x'] }] })).toBeUndefined();
    expect(diffBaseOf(await loadAgent(FIXTURES, 'echo'))).toBeUndefined();
  });
});
