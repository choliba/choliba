import type { CommandSpec } from '@choliba/core';

import { agentsEntries } from '../..';

describe('agentsEntries', () => {
  it('lists `agents` with its live spec, then each agent as a shortcut the root help does not list', () => {
    const spec: CommandSpec = {
      usage: 'choliba agents',
      commands: () => [
        { name: 'list', description: 'Lista', group: 'Commands', spec: { usage: 'x' } },
        { name: 'revisor', description: 'Revisa', group: 'Agents', spec: { usage: 'y' }, asFlag: true },
      ],
    };

    const [agents, ...shortcuts] = agentsEntries(() => spec);

    expect(agents?.spec).toBe(spec);
    expect(shortcuts).toEqual([
      { name: 'revisor', description: 'Revisa', group: 'Agents', spec: { usage: 'y' }, asFlag: false, listed: false },
    ]);
  });

  it('lists no shortcut when the spec has no commands or cannot read them', () => {
    expect(agentsEntries(() => ({ usage: 'choliba agents' }))).toHaveLength(1);
    const broken = agentsEntries(() => ({
      usage: 'choliba agents',
      commands: () => {
        throw new Error('sem pasta de trabalho');
      },
    }));
    expect(broken).toHaveLength(1);
  });

  it('keeps `agents` listed, with its usage only, when the workspace cannot be read', () => {
    const entries = agentsEntries(() => {
      throw new Error('sem pasta de trabalho');
    });

    expect(entries).toEqual([
      expect.objectContaining({ name: 'agents', spec: { usage: expect.any(String) as string } }),
    ]);
  });
});
