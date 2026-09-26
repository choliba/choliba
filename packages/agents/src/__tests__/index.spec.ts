import * as agents from '../index';

describe('public entrypoint', () => {
  it('re-exports every value binding the package promises', () => {
    // Each `export { a, b } from '...'` compiles to one getter per name; a getter only counts
    // as covered once something actually reads it — importing the module is not enough. This
    // touches every value export (not the type-only ones, which produce no runtime binding),
    // mirroring @choliba/terminal's own index.spec.ts.
    expect(agents.AgentConfigError).toBeDefined();
    expect(typeof agents.runAgentsCli).toBe('function');
    expect(typeof agents.isValidAgentName).toBe('function');
    expect(typeof agents.listAgents).toBe('function');
    expect(typeof agents.loadAgent).toBe('function');
    expect(typeof agents.parseAgentYaml).toBe('function');

    expect(typeof agents.resolveCommand).toBe('function');
    expect(typeof agents.defineCommand).toBe('function');
    expect(typeof agents.effectivePolicy).toBe('function');
    expect(typeof agents.commandFromAgent).toBe('function');
    expect(typeof agents.implicitCommand).toBe('function');

    expect(typeof agents.MAX_ARG_BYTES).toBe('number');
    expect(agents.PromptTooLargeError).toBeDefined();
    expect(typeof agents.assertArgvFits).toBe('function');
    expect(typeof agents.buildUserPrompt).toBe('function');
    expect(typeof agents.modeInstruction).toBe('function');
    expect(typeof agents.wrapInstructions).toBe('function');

    expect(typeof agents.readPlan).toBe('function');
    expect(typeof agents.resolvePlanPath).toBe('function');
    expect(typeof agents.slugify).toBe('function');
    expect(typeof agents.writePlan).toBe('function');

    expect(agents.claudeProvider).toBeDefined();
    expect(agents.cursorProvider).toBeDefined();
    expect(agents.InvalidProviderPreferenceError).toBeDefined();
    expect(agents.ProviderNotFoundError).toBeDefined();
    expect(Array.isArray(agents.PROVIDERS)).toBe(true);
    expect(typeof agents.parseProviderPreference).toBe('function');
    expect(typeof agents.resolveProvider).toBe('function');

    expect(typeof agents.renderEvent).toBe('function');
    expect(typeof agents.runAgent).toBe('function');
  });

  it('exposes a working command definition end to end through the barrel', () => {
    const command = agents.defineCommand({ name: 'x', agent: 'echo', description: 'd' });

    expect(command).toMatchObject({ policy: 'read-only', defaultMode: 'execute' });
    expect(agents.effectivePolicy(command, 'ask')).toBe('read-only');
  });
});
