import { ShellIo } from '../..';
import { fakePlatform } from '../../testing';

describe('ShellIo', () => {
  it('gives the arguments after the command path, as typed', () => {
    const io = new ShellIo(fakePlatform({ argv: ['projects', 'list', 'x', '--', 'y'] }));

    expect(io.args('projects', 'list')).toEqual(['x', '--', 'y']);
    expect(io.args('projects')).toEqual(['list', 'x', '--', 'y']);
  });

  it('writes the result and the help on stdout, exit code 0', () => {
    const platform = fakePlatform();
    const io = new ShellIo(platform);

    expect(io.wantsHelp(['-h'])).toBe(true);
    expect(io.wantsHelp(['run'])).toBe(false);
    io.printHelp({ usage: 'demo' });
    io.write('ok\n');

    expect(platform.stdout.text()).toBe('Usage:  demo\nok\n');
    expect(io.exitCode()).toBe(0);
  });

  it('passes on the exit code of what it ran', () => {
    const io = new ShellIo(fakePlatform());
    io.exit(7);

    expect(io.exitCode()).toBe(7);
  });

  it('fails with a message on stderr and exit code 1', () => {
    const platform = fakePlatform();
    const io = new ShellIo(platform);
    io.fail('quebrou');

    expect(platform.stderr.text()).toBe('quebrou\n');
    expect(io.exitCode()).toBe(1);
  });

  it('reports a usage error with where to read the usage, exit code 1', () => {
    const platform = fakePlatform();
    const io = new ShellIo(platform);
    io.usageError('flag desconhecida: --x.', 'choliba demo');

    expect(platform.stderr.text()).toBe("flag desconhecida: --x.\nRun 'choliba demo --help' for usage.\n");
    expect(io.exitCode()).toBe(1);
  });
});
