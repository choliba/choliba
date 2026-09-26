import { join } from 'node:path';

import type { AgentDefinition } from '../agent.types';
import { loadAgent } from '../agent-loader';
import { commandFromAgent, defineCommand, effectivePolicy, implicitCommand } from '../define-command';

const FIXTURES = join(__dirname, 'fixtures/agents');

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
    defaultMode: 'execute',
    dir: '/tmp/agents/echo',
    systemPromptPath: '/tmp/agents/echo/system.md',
    instructions: 'be an echo',
    ...overrides,
  };
}

describe('defineCommand', () => {
  it('fills in safe defaults when only the required fields are given', () => {
    const command = defineCommand({ name: 'x', agent: 'echo', description: 'd' });

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
    const command = defineCommand({
      name: 'x',
      agent: 'echo',
      description: 'd',
      policy: 'full',
      defaultMode: 'plan',
      taskRequired: false,
      addDirs: ['/extra'],
      prompt,
    });

    expect(command).toMatchObject({
      policy: 'full',
      defaultMode: 'plan',
      taskRequired: false,
      addDirs: ['/extra'],
    });
    expect(command.prompt({ task: '', repoRoot: '/r', agent: fakeAgent() })).toBe('custom');
  });
});

describe('commandFromAgent', () => {
  it('builds a read-only command for a plain agent', () => {
    const agent = fakeAgent({ name: 'reviewer', description: 'reviews code' });

    const command = commandFromAgent(agent);

    expect(command).toMatchObject({
      name: 'reviewer',
      agent: 'reviewer',
      description: 'reviews code',
      policy: 'read-only',
      taskRequired: true,
      defaultMode: 'execute',
    });
    expect(command.prepare).toBeUndefined();
    expect(command.afterExecuteSuccess).toBeUndefined();
  });

  it('wires prepare and afterExecuteSuccess from agent.yaml fields', async () => {
    const agent = await loadAgent(FIXTURES, 'with-prepare');

    const command = commandFromAgent(agent);

    expect(command).toMatchObject({
      name: 'with-prepare',
      policy: 'edits',
      taskRequired: false,
      defaultMode: 'execute',
    });
    expect(typeof command.prepare).toBe('function');
    expect(typeof command.afterExecuteSuccess).toBe('function');
  });
});

describe('implicitCommand', () => {
  it('is an alias for commandFromAgent', () => {
    const agent = fakeAgent({ name: 'reviewer', description: 'reviews code' });
    const fromAgent = commandFromAgent(agent);
    const implicit = implicitCommand(agent);

    expect(implicit.name).toBe(fromAgent.name);
    expect(implicit.policy).toBe(fromAgent.policy);
    expect(implicit.taskRequired).toBe(fromAgent.taskRequired);
    expect(implicit.defaultMode).toBe(fromAgent.defaultMode);
    expect(implicit.prepare).toBe(fromAgent.prepare);
    expect(implicit.afterExecuteSuccess).toBe(fromAgent.afterExecuteSuccess);
  });
});

describe('effectivePolicy', () => {
  it('uses the command policy in execute mode', () => {
    const command = defineCommand({ name: 'x', agent: 'echo', description: 'd', policy: 'full' });

    expect(effectivePolicy(command, 'execute')).toBe('full');
  });

  it.each(['plan', 'ask'] as const)('forces read-only in %s mode, regardless of the command policy', (mode) => {
    const command = defineCommand({ name: 'x', agent: 'echo', description: 'd', policy: 'full' });

    expect(effectivePolicy(command, mode)).toBe('read-only');
  });
});
