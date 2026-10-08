import type { CommandSpec } from '@choliba/core';

import { commandHelp } from '../../projects/projects.help';

const SPEC: CommandSpec = {
  usage: 'demo COMMAND',
  commands: () => [{ name: 'run', description: 'Roda', group: 'Commands', spec: { usage: 'demo run' } }],
};

describe('commandHelp', () => {
  it("is a command's own spec, described by its line, or the whole spec for a name it does not have", () => {
    expect(commandHelp(SPEC, 'run')).toEqual({ usage: 'demo run', description: 'Roda' });
    expect(commandHelp(SPEC, 'other')).toBe(SPEC);
  });
});
