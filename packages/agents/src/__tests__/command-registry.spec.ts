import { join } from 'node:path';

import { resolveCommand } from '../command-registry';
import { defineCommand } from '../define-command';

const FIXTURES = join(__dirname, 'fixtures/agents');

describe('resolveCommand', () => {
  it('returns the explicit command when its name matches, without touching the agents dir', async () => {
    const explicit = defineCommand({ name: 'echo', agent: 'echo', description: 'explicit', policy: 'full' });

    const resolved = await resolveCommand('echo', [explicit], '/nonexistent-dir');

    expect(resolved).toBe(explicit);
  });

  it('falls back to a command built from a loadable agent', async () => {
    const resolved = await resolveCommand('reviewer', [], FIXTURES);

    expect(resolved).toMatchObject({ name: 'reviewer', agent: 'reviewer', policy: 'read-only' });
  });

  it('builds prepare hooks for agents that declare them in agent.yaml', async () => {
    const resolved = await resolveCommand('with-prepare', [], FIXTURES);

    expect(resolved).toMatchObject({
      name: 'with-prepare',
      policy: 'edits',
      taskRequired: false,
    });
    expect(typeof resolved?.prepare).toBe('function');
    expect(typeof resolved?.afterExecuteSuccess).toBe('function');
  });

  it('returns undefined for a name that is neither an explicit command nor a loadable agent', async () => {
    expect(await resolveCommand('nope', [], FIXTURES)).toBeUndefined();
  });

  it('returns undefined for an invalid agent name, without throwing', async () => {
    expect(await resolveCommand('../etc', [], FIXTURES)).toBeUndefined();
  });

  it('prefers the explicit command over an agent of the same name', async () => {
    const explicit = defineCommand({ name: 'echo', agent: 'echo', description: 'explicit', policy: 'full' });

    const resolved = await resolveCommand('echo', [explicit], FIXTURES);

    expect(resolved?.policy).toBe('full');
  });
});
