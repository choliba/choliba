import { join } from 'node:path';

import * as gitDiff from '../../../agents/steps/git-working-tree-diff';

import type { AgentDefinition, AgentModeSteps } from '../../../common/interfaces/agent.interface';
import { loadAgent } from '../../../agents/agent-loader';
import * as actionsModule from '../../../agents/steps/step-actions';
import { buildAfter, buildPrepare, diffBaseOf } from '../../../agents/steps/step-registry';
import { readGitState } from '../../../agents/steps/git-state';
import { NO_MODE_STEPS, NO_STEPS } from '../../helpers/agent';
import { makeTmpGitRepo } from '../../helpers/git-repo';
import { makeTmpDir } from '../../helpers/tmp';

const FIXTURES = join(__dirname, '..', '..', 'fixtures', 'agents');

function withSteps(agent: AgentDefinition, mode: 'execute' | 'plan' | 'ask', steps: AgentModeSteps): AgentDefinition {
  return { ...agent, steps: { ...NO_MODE_STEPS, [mode]: steps } };
}

describe('buildPrepare / buildAfter', () => {
  it('returns undefined for agents without steps nor a default task', () => {
    const agent = loadAgent(FIXTURES, 'echo');

    expect(buildPrepare(agent)).toBeUndefined();
    expect(buildAfter(agent)).toBeUndefined();
  });

  it('wires the steps of with-prepare: its before in execute, and its after.success', () => {
    const agent = loadAgent(FIXTURES, 'with-prepare');
    const prepare = buildPrepare(agent);
    const after = buildAfter(agent);

    if (prepare === undefined || after === undefined) {
      throw new Error('expected prepare and after hooks');
    }

    const getDiff = jest.spyOn(gitDiff, 'getWorkingTreeDiff').mockReturnValue('diff --git a/a.ts b/a.ts\n');
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
        expect(after({ repoRoot: gitRepo.path, mode: 'execute', exitCode: 0 })).toEqual([]);
        expect(readGitState(gitRepo.path, '.cache/with-prepare/last-base')).toMatch(/^[0-9a-f]{40}$/);
      } finally {
        gitRepo.cleanup();
      }
    } finally {
      tmp.cleanup();
      getDiff.mockRestore();
    }
  });

  it('runs only the before steps of the run mode, adds the user task as focus and passes --since', () => {
    const base = loadAgent(FIXTURES, 'with-prepare');
    const run = jest.spyOn(actionsModule, 'runBeforeSteps').mockReturnValue(['ctx']);
    try {
      const result = buildPrepare(base)?.({
        task: 'focar README',
        repoRoot: '/repo',
        agent: base,
        mode: 'execute',
        since: 'HEAD~1',
      });
      const plan = buildPrepare(base)?.({ task: 'x', repoRoot: '/repo', agent: base, mode: 'plan' });

      expect(result).toEqual({ task: 'focar README', promptBody: 'ctx\n\nFoco pedido pelo usuário: focar README' });
      expect(run).toHaveBeenNthCalledWith(
        1,
        { repoRoot: '/repo', since: 'HEAD~1' },
        base.steps.execute.before,
        'execute.before',
      );
      expect(run).toHaveBeenNthCalledWith(2, { repoRoot: '/repo', since: undefined }, [], 'plan.before');
      expect(plan).toEqual({ task: 'x', promptBody: 'ctx\n\nFoco pedido pelo usuário: x' });
    } finally {
      run.mockRestore();
    }
  });

  it('runs nothing on --dry-run, marking what each step would add', () => {
    const base = loadAgent(FIXTURES, 'with-prepare');
    const run = jest.spyOn(actionsModule, 'runBeforeSteps');
    try {
      const result = buildPrepare(base)?.({ task: '', repoRoot: '/repo', agent: base, mode: 'execute', dryRun: true });

      expect(run).not.toHaveBeenCalled();
      expect(result?.promptBody.split('\n\n')).toEqual([
        '[execute.before 1/3 — git_diff: develop .cache/with-prepare/diff.patch --pending .cache/with-prepare/last-base: produzido aqui na execução real]',
        '[execute.before 2/3 — add_files: documentacao_atual docs/**/*.md: produzido aqui na execução real]',
        '[execute.before 3/3 — add_files: readme_atual README.md: produzido aqui na execução real]',
      ]);
    } finally {
      run.mockRestore();
    }
  });

  it('builds a prepare from default_task alone, whose prompt is the task', () => {
    const echo = loadAgent(FIXTURES, 'echo');
    const agent: AgentDefinition = { ...echo, defaultTask: 'padrão' };

    expect(buildPrepare(agent)?.({ task: ' ', repoRoot: '/repo', agent, mode: 'execute' })).toEqual({
      task: 'padrão',
      promptBody: 'padrão',
    });
    const { defaultTask: _unused, ...withoutDefault } = withSteps(agent, 'ask', {
      ...NO_STEPS,
      before: [{ action: 'run', args: ['x'] }],
    });
    expect(buildPrepare(withoutDefault)?.({ task: '', repoRoot: '/repo', agent, mode: 'execute' })).toEqual({
      task: '',
      promptBody: '',
    });
  });

  it('runs success or failure after the agent, then always, each with the exit code filled in', () => {
    const echo = loadAgent(FIXTURES, 'echo');
    const agent = withSteps(echo, 'plan', {
      before: [],
      after: {
        success: [{ action: 'run', args: ['ok', '${AGENT_EXIT_CODE}'] }],
        failure: [{ action: 'run', args: ['ko', '${AGENT_EXIT_CODE}'] }],
        always: [{ action: 'run', args: ['clean'] }],
      },
    });
    const failure = { label: 'x', step: { action: 'run', args: [] }, status: 1, output: '' };
    const run = jest.spyOn(actionsModule, 'runAfterSteps').mockReturnValue([failure]);
    try {
      const after = buildAfter(agent);

      expect(after?.({ repoRoot: '/repo', mode: 'plan', exitCode: 0 })).toEqual([failure, failure]);
      expect(after?.({ repoRoot: '/repo', mode: 'plan', exitCode: 3 })).toHaveLength(2);
      expect(after?.({ repoRoot: '/repo', mode: 'execute', exitCode: 0 })).toHaveLength(2);
      const context = { repoRoot: '/repo', since: undefined };
      expect(run.mock.calls).toEqual([
        [context, [{ action: 'run', args: ['ok', '0'] }], 'plan.after.success'],
        [context, [{ action: 'run', args: ['clean'] }], 'plan.after.always'],
        [context, [{ action: 'run', args: ['ko', '3'] }], 'plan.after.failure'],
        [context, [{ action: 'run', args: ['clean'] }], 'plan.after.always'],
        [context, [], 'execute.after.success'],
        [context, [], 'execute.after.always'],
      ]);
    } finally {
      run.mockRestore();
    }
  });
});

describe('diffBaseOf', () => {
  it("reads the base of the agent's git_diff, in any mode", () => {
    const agent = loadAgent(FIXTURES, 'with-prepare');
    const gitDiffIn = (args: readonly string[]) =>
      withSteps(agent, 'ask', { ...NO_STEPS, before: [{ action: 'git_diff', args }] });

    expect(diffBaseOf(agent)).toBe('develop');
    expect(diffBaseOf(gitDiffIn(['main', 'd.patch']))).toBe('main');
    expect(diffBaseOf(gitDiffIn(['x']))).toBeUndefined();
    expect(diffBaseOf(loadAgent(FIXTURES, 'echo'))).toBeUndefined();
  });
});
