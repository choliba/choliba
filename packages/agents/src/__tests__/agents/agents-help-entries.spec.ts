import type { CommandSpec } from '@choliba/core';
import type { CommandIo } from '@choliba/core/nest';

import { AgentsCommand, type AgentsService } from '../../nest';

function commandWith(helpSpec: () => CommandSpec): AgentsCommand {
  return new AgentsCommand({} as unknown as CommandIo, { helpSpec } as unknown as AgentsService);
}

describe('AgentsCommand.helpEntries', () => {
  it('lists `agents` with its live spec, then each agent as a shortcut the root help does not list', () => {
    const spec: CommandSpec = {
      usage: 'choliba agents',
      commands: () => [
        { name: 'list', description: 'Lista', group: 'Commands', spec: { usage: 'x' } },
        { name: 'revisor', description: 'Revisa', group: 'Agents', spec: { usage: 'y' }, asFlag: true },
      ],
    };

    const [agents, ...shortcuts] = commandWith(() => spec).helpEntries();

    expect(agents?.spec).toBe(spec);
    expect(shortcuts).toEqual([
      { name: 'revisor', description: 'Revisa', group: 'Agents', spec: { usage: 'y' }, asFlag: false, listed: false },
    ]);
  });

  it('lists no shortcut when the spec has no commands or cannot read them', () => {
    expect(commandWith(() => ({ usage: 'choliba agents' })).helpEntries()).toHaveLength(1);
    const broken = commandWith(() => ({
      usage: 'choliba agents',
      commands: () => {
        throw new Error('sem pasta de trabalho');
      },
    }));
    expect(broken.helpEntries()).toHaveLength(1);
  });

  it('keeps `agents` listed, with its usage only, when the workspace cannot be read', () => {
    const entries = commandWith(() => {
      throw new Error('sem pasta de trabalho');
    }).helpEntries();

    expect(entries).toEqual([
      expect.objectContaining({ name: 'agents', spec: { usage: expect.any(String) as string } }),
    ]);
  });
});
