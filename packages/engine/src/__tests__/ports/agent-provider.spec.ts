import { AgentProvider, commandViolation, wrapInstructions, type ProviderRequest, type StreamParser } from '../..';
import { NO_PERMISSIONS } from '@choliba/domain';

class StubProvider extends AgentProvider {
  readonly id = 'stub';
  readonly binaries = [['stub']] as const;
  readonly autoPriority = 1;
  readonly credentials = ['STUB_KEY'] as const;
  readonly credentialHelp = 'set STUB_KEY';

  buildArgs(_request: ProviderRequest): readonly string[] {
    return ['--ok'];
  }

  createParser(): StreamParser {
    return { parseLine: () => [], sawInitWithModel: false };
  }
}

describe('@choliba/engine ports', () => {
  it('exposes the provider contract with restrictive defaults through its entry', () => {
    const provider = new StubProvider();

    expect(provider.unenforcedTools).toEqual([]);
    expect(provider.enforcesExecute).toBe(true);
    expect(provider.oneShotInput).toBe(false);
    expect(provider.inAuto).toBe(true);
    expect(provider.needsModel).toBe(false);
    expect(provider.declaredModel('gpt')).toBe('gpt');
    expect(provider.localReadOnly('/bin/stub')).toEqual(['/bin/stub']);
    expect(provider.createParser().parseLine('')).toEqual([]);
  });

  it('builds a prompt and a command guard from the same public entry', () => {
    const wrapped = wrapInstructions({
      name: 'echo',
      id: 'echo',
      displayName: 'Echo',
      version: '1.0.0',
      description: 'echoes',
      providers: [],
      skills: [],
      mcps: [],
      policy: 'read-only',
      taskRequired: true,
      projectRequired: false,
      allowWithoutTicket: false,
      defaultMode: 'execute',
      modes: ['execute'],
      permissions: NO_PERMISSIONS,
      dir: '/agents/echo',
      sections: {
        role: 'Be an echo.',
        context: [],
        input: 'The task.',
        flow: '1. Do it.',
        output: 'The result.',
        notes: [],
      },
      steps: {
        execute: { before: [], after: { success: [], failure: [], always: [] } },
        plan: { before: [], after: { success: [], failure: [], always: [] } },
        ask: { before: [], after: { success: [], failure: [], always: [] } },
      },
      sourcePath: '/agents/echo/agent.yaml',
    });

    expect(wrapped).toContain('<agent_instructions');
    expect(commandViolation('pwd', { allowed: [], denied: [], closedDirs: [], cwd: '/run' })).toBeUndefined();
  });
});
