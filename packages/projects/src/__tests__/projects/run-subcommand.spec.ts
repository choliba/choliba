import { Test } from '@nestjs/testing';

import type { CommandSpec } from '@choliba/core/cli';
import { CliModule, CommandIo, ExitStatus, PlatformModule } from '@choliba/core/nest';
import { fakePlatform } from '@choliba/core/testing';

import { commandHelp } from '../../projects/projects.help';
import { runSubcommand } from '../../projects/run-subcommand';

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

describe('runSubcommand', () => {
  it('reports something thrown that is not an Error as it is', async () => {
    const platform = fakePlatform({ argv: ['projects', 'run'] });
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot(platform), CliModule],
    }).compile();

    const thrown: unknown = 'texto solto';
    runSubcommand(
      moduleRef.get(CommandIo),
      () => SPEC,
      'run',
      () => {
        throw thrown;
      },
    );

    expect(platform.stderr.text()).toBe('texto solto\n');
    expect(moduleRef.get(ExitStatus).code()).toBe(1);
  });
});
