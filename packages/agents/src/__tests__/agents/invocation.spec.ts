import { join } from 'node:path';

import type { AgentDefinition } from '../../common/interfaces/agent.interface';
import { loadAgent } from '../../agents/agent-loader';
import { invocationFromAgent, defineInvocation, effectivePolicy, implicitInvocation } from '../../agents/invocation';
import { NO_PERMISSIONS } from '../../common/agent-permissions';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';

const FIXTURES = join(__dirname, '..', 'fixtures/agents');

function fakeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'echo',
    id: 'example-echo-agent',
    displayName: 'Echo',
    version: '1.0.0',
    description: 'repeats things',
    supportedModels: [],
    skills: [],
    mcps: [],
    policy: 'read-only',
    taskRequired: true,
    projectRequired: false,
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute', 'plan', 'ask'],
    permissions: NO_PERMISSIONS,
    dir: '/tmp/agents/echo',
    sections: fakeSections('be an echo'),
    steps: NO_MODE_STEPS,
    sourcePath: '/tmp/agents/echo/agent.yaml',
    ...overrides,
  };
}

describe('defineInvocation', () => {
  it('fills in safe defaults when only the required fields are given', () => {
    const command = defineInvocation({ name: 'x', agent: 'echo', description: 'd' });

    expect(command).toMatchObject({
      name: 'x',
      agent: 'echo',
      description: 'd',
      policy: 'read-only',
      defaultMode: 'execute',
      taskRequired: true,
      addDirs: [],
    });
    expect(command.prompt({ task: 'do it', repoRoot: '/r', agent: fakeAgent() })).toBe('do it');
  });

  it('keeps every field the caller overrides', () => {
    const prompt = (): string => 'custom';
    const command = defineInvocation({
      name: 'x',
      agent: 'echo',
      description: 'd',
      policy: 'edits',
      defaultMode: 'plan',
      taskRequired: false,
      addDirs: ['/extra'],
      prompt,
    });

    expect(command).toMatchObject({
      policy: 'edits',
      defaultMode: 'plan',
      taskRequired: false,
      addDirs: ['/extra'],
    });
    expect(command.prompt({ task: '', repoRoot: '/r', agent: fakeAgent() })).toBe('custom');
  });
});

describe('invocationFromAgent', () => {
  it('builds a read-only command for a plain agent', () => {
    const agent = fakeAgent({ name: 'reviewer', description: 'reviews code' });

    const command = invocationFromAgent(agent);

    expect(command).toMatchObject({
      name: 'reviewer',
      agent: 'reviewer',
      description: 'reviews code',
      policy: 'read-only',
      taskRequired: true,
      defaultMode: 'execute',
    });
    expect(command.prepare).toBeUndefined();
    expect(command.after).toBeUndefined();
  });

  it('wires prepare and after from the steps of agent.yaml', () => {
    const agent = loadAgent(FIXTURES, 'with-prepare');

    const command = invocationFromAgent(agent);

    expect(command).toMatchObject({
      name: 'with-prepare',
      policy: 'edits',
      taskRequired: false,
      defaultMode: 'execute',
    });
    expect(typeof command.prepare).toBe('function');
    expect(typeof command.after).toBe('function');
  });
});

describe('implicitInvocation', () => {
  it('is an alias for invocationFromAgent', () => {
    const agent = fakeAgent({ name: 'reviewer', description: 'reviews code' });
    const fromAgent = invocationFromAgent(agent);
    const implicit = implicitInvocation(agent);

    expect(implicit.name).toBe(fromAgent.name);
    expect(implicit.policy).toBe(fromAgent.policy);
    expect(implicit.taskRequired).toBe(fromAgent.taskRequired);
    expect(implicit.defaultMode).toBe(fromAgent.defaultMode);
    expect(implicit.prepare).toBe(fromAgent.prepare);
    expect(implicit.after).toBe(fromAgent.after);
  });
});

describe('effectivePolicy', () => {
  it('uses the command policy in execute mode', () => {
    const command = defineInvocation({ name: 'x', agent: 'echo', description: 'd', policy: 'edits' });

    expect(effectivePolicy(command, 'execute')).toBe('edits');
  });

  it.each(['plan', 'ask'] as const)('forces read-only in %s mode, regardless of the command policy', (mode) => {
    const command = defineInvocation({ name: 'x', agent: 'echo', description: 'd', policy: 'edits' });

    expect(effectivePolicy(command, mode)).toBe('read-only');
  });
});
