import { Test } from '@nestjs/testing';

import { CliModule, CommandIo, ExitStatus, PlatformModule } from '../../nest';
import { fakePlatform, type FakePlatform } from '../../testing';

async function ioFor(platform: FakePlatform): Promise<{ io: CommandIo; exit: ExitStatus }> {
  const moduleRef = await Test.createTestingModule({
    imports: [PlatformModule.forRoot(platform), CliModule],
  }).compile();
  return { io: moduleRef.get(CommandIo), exit: moduleRef.get(ExitStatus) };
}

describe('CommandIo', () => {
  it('gives the arguments after the command path, as typed', async () => {
    const { io } = await ioFor(fakePlatform({ argv: ['projects', 'create-project', 'x', '--', 'y'] }));

    expect(io.args('projects', 'create-project')).toEqual(['x', '--', 'y']);
    expect(io.args('projects')).toEqual(['create-project', 'x', '--', 'y']);
  });

  it('writes the result on stdout and prints help', async () => {
    const platform = fakePlatform();
    const { io, exit } = await ioFor(platform);

    expect(io.wantsHelp(['-h'])).toBe(true);
    io.printHelp({ usage: 'demo' });
    io.write('ok\n');

    expect(platform.stdout.text()).toBe('Usage:  demo\nok\n');
    expect(exit.code()).toBe(0);

    io.exit(7);
    expect(exit.code()).toBe(7);
  });

  it('fails with a message, or with a usage error, on stderr and exit code 1', async () => {
    const platform = fakePlatform();
    const { io, exit } = await ioFor(platform);

    io.fail('quebrou');
    expect(platform.stderr.text()).toBe('quebrou\n');
    expect(exit.code()).toBe(1);

    const other = fakePlatform();
    const second = await ioFor(other);
    second.io.usageError('Falta X.', 'demo');
    expect(other.stderr.text()).toBe("Falta X.\nRun 'demo --help' for usage.\n");
    expect(second.exit.code()).toBe(1);
  });
});
