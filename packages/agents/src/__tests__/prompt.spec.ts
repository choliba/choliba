import type { AgentDefinition } from '../agent.types';
import {
  MAX_ARG_BYTES,
  PromptTooLargeError,
  assertArgvFits,
  buildUserPrompt,
  modeInstruction,
  wrapInstructions,
} from '../prompt';

function fakeAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    name: 'echo',
    id: 'example-echo-agent',
    displayName: 'Echo Agent',
    version: '1.0.0',
    description: 'repeats things',
    supportedModels: [],
    skills: [],
    mcps: [],
    policy: 'read-only',
    taskRequired: true,
    projectRequired: false,
    defaultMode: 'execute',
    dir: '/repo/agents/echo',
    systemPromptPath: '/repo/agents/echo/system.md',
    instructions: 'Be an echo. See ./companion.md.',
    ...overrides,
  };
}

describe('wrapInstructions', () => {
  it('states the agent directory and includes the instructions verbatim', () => {
    const wrapped = wrapInstructions(fakeAgent());

    expect(wrapped).toContain('relative to /repo/agents/echo/');
    expect(wrapped).toContain('Be an echo. See ./companion.md.');
    expect(wrapped).toContain('<agent_instructions');
    expect(wrapped).toContain('</agent_instructions>');
  });

  it("opens with the order to use the agent's skills, when there is one", () => {
    const wrapped = wrapInstructions(fakeAgent(), 'Utilize a skill docs: leia `x/SKILL.md`.');

    expect(wrapped.split('\n').slice(1, 3)).toEqual(['Utilize a skill docs: leia `x/SKILL.md`.', '']);
    expect(wrapInstructions(fakeAgent(), '')).toBe(wrapInstructions(fakeAgent()));
  });

  it('escapes double quotes in metadata used as XML-ish attribute values', () => {
    const wrapped = wrapInstructions(fakeAgent({ displayName: 'The "Echo" Agent' }));

    expect(wrapped).toContain('name="The &quot;Echo&quot; Agent"');
  });
});

describe('modeInstruction', () => {
  it('is empty for execute mode', () => {
    expect(modeInstruction('execute')).toBe('');
  });

  it('tells the model its tools are read-only, and states the goal, for plan and ask', () => {
    expect(modeInstruction('plan')).toMatch(/read-only/i);
    expect(modeInstruction('plan')).toMatch(/plan/i);
    expect(modeInstruction('ask')).toMatch(/read-only/i);
    expect(modeInstruction('ask')).toMatch(/answer/i);
  });
});

describe('buildUserPrompt', () => {
  it('is just the task in execute mode with no saved plan', () => {
    const prompt = buildUserPrompt({ templateOutput: 'do the thing', mode: 'execute', planContent: undefined });

    expect(prompt).not.toMatch(/read-only/i);
    expect(prompt).toContain('do the thing');
  });

  it('leads with the mode instruction, never with the task, in plan/ask mode', () => {
    const prompt = buildUserPrompt({ templateOutput: 'do the thing', mode: 'ask', planContent: undefined });

    expect(prompt.startsWith('You have read-only tools')).toBe(true);
  });

  it('includes a saved plan before the task when resuming one', () => {
    const prompt = buildUserPrompt({ templateOutput: 'implement it', mode: 'execute', planContent: '1. do x' });

    expect(prompt.indexOf('1. do x')).toBeLessThan(prompt.indexOf('implement it'));
  });

  it('never starts with a task that begins with "-", so no CLI parser mistakes it for a flag', () => {
    const prompt = buildUserPrompt({ templateOutput: '--dangerous', mode: 'execute', planContent: undefined });

    expect(prompt.startsWith('-')).toBe(false);
  });
});

describe('assertArgvFits', () => {
  it('accepts arguments within the limit', () => {
    expect(() => {
      assertArgvFits(['short', 'a'.repeat(1000)]);
    }).not.toThrow();
  });

  it('throws PromptTooLargeError naming the offending argument index', () => {
    const args = ['ok', 'a'.repeat(MAX_ARG_BYTES + 1)];

    expect(() => {
      assertArgvFits(args);
    }).toThrow(PromptTooLargeError);
    expect(() => {
      assertArgvFits(args);
    }).toThrow(/argument 1/);
  });

  it('accepts an argument exactly at the limit', () => {
    expect(() => {
      assertArgvFits(['a'.repeat(MAX_ARG_BYTES)]);
    }).not.toThrow();
  });
});
