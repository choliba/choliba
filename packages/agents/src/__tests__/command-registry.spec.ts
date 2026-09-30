import { join } from 'node:path';

import { resolveCommand } from '../command-registry';
import { defineCommand } from '../define-command';

const FIXTURES = join(__dirname, 'fixtures/agents');

describe('resolveCommand', () => {
  it('returns the explicit command when its name matches, without touching the agents dir', () => {
    const explicit = defineCommand({ name: 'echo', agent: 'echo', description: 'explicit', policy: 'edits' });

    const resolved = resolveCommand('echo', [explicit], '/nonexistent-dir');

    expect(resolved).toBe(explicit);
  });

  it('falls back to a command built from a loadable agent', () => {
    const resolved = resolveCommand('reviewer', [], FIXTURES);

    expect(resolved).toMatchObject({ name: 'reviewer', agent: 'reviewer', policy: 'read-only' });
  });

  it('builds prepare hooks for agents that declare them in agent.yaml', () => {
    const resolved = resolveCommand('with-prepare', [], FIXTURES);

    expect(resolved).toMatchObject({
      name: 'with-prepare',
      policy: 'edits',
      taskRequired: false,
    });
    expect(typeof resolved?.prepare).toBe('function');
    expect(typeof resolved?.after).toBe('function');
  });

  it('returns undefined for a name that is neither an explicit command nor a loadable agent', () => {
    expect(resolveCommand('nope', [], FIXTURES)).toBeUndefined();
  });

  it('throws the reason when the agent exists but does not load, naming the file', () => {
    expect(() => resolveCommand('missing-sections', [], FIXTURES)).toThrow(/missing-sections\/agent\.yaml: .*'role'/);
  });

  it('returns undefined for an invalid agent name, without throwing', () => {
    expect(resolveCommand('../etc', [], FIXTURES)).toBeUndefined();
  });

  it('prefers the explicit command over an agent of the same name', () => {
    const explicit = defineCommand({ name: 'echo', agent: 'echo', description: 'explicit', policy: 'edits' });

    const resolved = resolveCommand('echo', [explicit], FIXTURES);

    expect(resolved?.policy).toBe('edits');
  });
});
