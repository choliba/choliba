import { Test } from '@nestjs/testing';

import { type CommandSpec, wantsHelp } from '../../help';
import { CliHelpService, CliModule, PlatformModule } from '../../nest';
import { fakePlatform, type FakePlatform } from '../../testing';

const SPEC: CommandSpec = {
  usage: 'demo COMMAND',
  description: 'Uma CLI de exemplo\n\n  demo list    lista tudo',
  commands: () => [
    { name: 'list', description: 'Lista tudo', group: 'Commands', spec: { usage: 'demo list' } },
    { name: 'show', description: 'Mostra um', group: 'Commands', spec: { usage: 'demo show' } },
  ],
};

async function serviceWith(platform: FakePlatform): Promise<CliHelpService> {
  const moduleRef = await Test.createTestingModule({
    imports: [PlatformModule.forRoot(platform), CliModule],
  }).compile();
  return moduleRef.get(CliHelpService);
}

describe('wantsHelp', () => {
  it('is -h, --help anywhere, or help as the first word', () => {
    expect(wantsHelp(['--help'])).toBe(true);
    expect(wantsHelp(['list', '-h'])).toBe(true);
    expect(wantsHelp(['help', 'list'])).toBe(true);
    expect(wantsHelp(['list', 'help'])).toBe(false);
    expect(wantsHelp([])).toBe(false);
  });
});

describe('CliHelpService', () => {
  it('prints the help of a spec on stdout', async () => {
    const platform = fakePlatform();
    const cli = await serviceWith(platform);

    expect(cli.wantsHelp(['-h'])).toBe(true);
    cli.printHelp(SPEC);

    expect(platform.stdout.text()).toContain('Usage:  demo COMMAND');
    expect(platform.stdout.text()).toContain('Lista tudo');
    expect(platform.stderr.text()).toBe('');
  });

  it('prints one completion per line, and nothing when none fits', async () => {
    const platform = fakePlatform();
    const cli = await serviceWith(platform);

    cli.printCompletions(SPEC, ['']);
    cli.printCompletions(SPEC, ['zzz']);

    expect(platform.stdout.text()).toBe('list\nshow\n');
  });

  it('describes what the words select', async () => {
    const platform = fakePlatform();
    const cli = await serviceWith(platform);

    cli.printDescription(SPEC, ['show']);
    cli.printDescription(SPEC, []);

    expect(platform.stdout.text()).toBe('Mostra um\nUma CLI de exemplo\n');
  });

  it('reports a usage error on stderr with where to read the usage, and exit code 1', async () => {
    const platform = fakePlatform();
    const cli = await serviceWith(platform);

    expect(cli.usageError('Falta o projeto.', 'demo show')).toBe(1);
    expect(platform.stderr.text()).toBe("Falta o projeto.\nRun 'demo show --help' for usage.\n");
    expect(platform.stdout.text()).toBe('');
  });
});
