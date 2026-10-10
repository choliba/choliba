import { complete, describe as describeLine, formatSuggestions, wantsHelp, type CommandSpec } from '../../help';
import { ShellIo } from '../../shell';
import { fakePlatform } from '../../testing';

const SPEC: CommandSpec = {
  usage: 'demo COMMAND',
  description: 'Uma CLI de exemplo\n\n  demo list    lista tudo',
  commands: () => [
    { name: 'list', description: 'Lista tudo', group: 'Commands', spec: { usage: 'demo list' } },
    { name: 'show', description: 'Mostra um', group: 'Commands', spec: { usage: 'demo show' } },
  ],
};

describe('wantsHelp', () => {
  it('is -h, --help anywhere, or help as the first word', () => {
    expect(wantsHelp(['--help'])).toBe(true);
    expect(wantsHelp(['list', '-h'])).toBe(true);
    expect(wantsHelp(['help', 'list'])).toBe(true);
    expect(wantsHelp(['list', 'help'])).toBe(false);
    expect(wantsHelp([])).toBe(false);
  });
});

describe('help printed from a spec', () => {
  it('prints the help of a spec on stdout', () => {
    const platform = fakePlatform();
    const io = new ShellIo(platform);

    expect(io.wantsHelp(['-h'])).toBe(true);
    io.printHelp(SPEC);

    expect(platform.stdout.text()).toContain('Usage:  demo COMMAND');
    expect(platform.stdout.text()).toContain('Lista tudo');
    expect(platform.stderr.text()).toBe('');
  });

  it('prints one completion per line, and nothing when none fits', () => {
    const fitted = formatSuggestions(complete(SPEC, ['']));
    const none = formatSuggestions(complete(SPEC, ['zzz']));

    expect(`${fitted}\n`).toBe('list\nshow\nhelp\nversion\n');
    expect(none).toBe('');
  });

  it('describes what the words select', () => {
    const show = describeLine(SPEC, ['show']).split('\n')[0];
    const root = describeLine(SPEC, []).split('\n')[0];

    expect(`${String(show)}\n${String(root)}\n`).toBe('Mostra um\nUma CLI de exemplo\n');
  });

  it('reports a usage error on stderr with where to read the usage, and exit code 1', () => {
    const platform = fakePlatform();
    const io = new ShellIo(platform);

    io.usageError('Falta o projeto.', 'demo show');

    expect(io.exitCode()).toBe(1);
    expect(platform.stderr.text()).toBe("Falta o projeto.\nRun 'demo show --help' for usage.\n");
    expect(platform.stdout.text()).toBe('');
  });
});
