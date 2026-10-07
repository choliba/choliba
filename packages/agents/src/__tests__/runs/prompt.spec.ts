import type { AgentDefinition } from '../../agents/interfaces/agent.interface';
import {
  MAX_ARG_BYTES,
  PromptTooLargeError,
  assertArgvFits,
  buildUserPrompt,
  formatMcps,
  formatSections,
  modeInstruction,
  wrapInstructions,
} from '../../runs/prompt';
import { NO_PERMISSIONS } from '../../runs/permissions';
import { NO_MODE_STEPS, fakeSections } from '../helpers/agent';

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
    allowWithoutTicket: false,
    defaultMode: 'execute',
    modes: ['execute', 'plan', 'ask'],
    permissions: NO_PERMISSIONS,
    dir: '/repo/agents/echo',
    sections: fakeSections('Be an echo. See ./companion.md.'),
    steps: NO_MODE_STEPS,
    sourcePath: '/repo/agents/echo/agent.yaml',
    ...overrides,
  };
}

describe('formatSections', () => {
  it('turns the text of agent.yaml into the sections of the prompt, in order', () => {
    const text = formatSections({
      role: 'Papel.\n',
      context: ['Um.', 'Dois.'],
      input: 'Entrada.',
      flow: '1. Faça.',
      output: 'Saída.',
      notes: ['Nota.'],
    });

    expect(text).toBe(
      [
        '<system_role>\nPapel.\n</system_role>',
        '<context>\n<item>\nUm.\n</item>\n<item>\nDois.\n</item>\n</context>',
        '<input_contract>\nEntrada.\n</input_contract>',
        '<execution_flow>\n1. Faça.\n</execution_flow>',
        '<output_contract>\nSaída.\n</output_contract>',
        '<notes>\n<note>\nNota.\n</note>\n</notes>',
      ].join('\n\n'),
    );
  });

  it('leaves out context and notes when the agent has none', () => {
    const text = formatSections({ role: 'r', context: [], input: 'i', flow: 'f', output: 'o', notes: [] });

    expect(text).not.toContain('<context>');
    expect(text).not.toContain('<notes>');
  });
});

describe('formatMcps', () => {
  it('lists each server with its tools and how the agent uses it', () => {
    expect(
      formatMcps([
        { name: 'mcp-app', tools: ['jira_get_issue', 'jira_search'], instructions: 'Use for Jira.\n' },
        { name: 'docs' },
      ]),
    ).toBe(
      [
        '<mcps>',
        'Enforced by the command: these are the only MCP servers of this session, and each only has the tools listed.',
        '<mcp name="mcp-app" tools="jira_get_issue, jira_search">',
        'Use for Jira.',
        '</mcp>',
        '<mcp name="docs" tools="every tool"></mcp>',
        '</mcps>',
      ].join('\n'),
    );
  });

  it('is empty when the agent declares no server', () => {
    expect(formatMcps([])).toBe('');
  });
});

describe('wrapInstructions', () => {
  it('states the agent directory and where the agent.yaml is, and includes its text', () => {
    const wrapped = wrapInstructions(fakeAgent());

    expect(wrapped).toContain('relative to /repo/agents/echo/');
    expect(wrapped).toContain('source="/repo/agents/echo/agent.yaml"');
    expect(wrapped).toContain('<system_role>\nBe an echo. See ./companion.md.\n</system_role>');
    expect(wrapped).toContain('<agent_instructions');
    expect(wrapped).toContain('</agent_instructions>');
    expect(wrapped).not.toContain('<mcps>');
  });

  it('puts the MCP servers after the permissions and before the text', () => {
    const wrapped = wrapInstructions(fakeAgent({ mcps: [{ name: 'mcp-app' }] }));

    // The tag on a line of its own: the permissions name <mcps> in a sentence too.
    expect(wrapped.indexOf('</permissions>')).toBeLessThan(wrapped.indexOf('\n<mcps>\n'));
    expect(wrapped).toContain('MCP: you may use only the servers and tools listed in <mcps>');
    expect(wrapped.indexOf('</mcps>')).toBeLessThan(wrapped.indexOf('<system_role>'));
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
