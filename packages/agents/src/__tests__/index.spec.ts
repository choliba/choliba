import * as agents from '../index';

describe('public entrypoint', () => {
  it('exposes a working command definition end to end through the barrel', () => {
    const command = agents.defineInvocation({ name: 'x', agent: 'echo', description: 'd' });

    expect(command).toMatchObject({ policy: 'read-only', defaultMode: 'execute' });
    expect(agents.effectivePolicy(command, 'ask')).toBe('read-only');
  });
});
