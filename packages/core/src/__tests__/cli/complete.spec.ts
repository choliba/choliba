import type { CommandSpec, Suggestions } from '../../cli/cli.types';
import { complete, describe as describeCommand, FILES_MARKER, formatSuggestions } from '../../cli/complete';

const values = (...list: string[]): Suggestions => ({ kind: 'values', values: list });

const deploy: CommandSpec = {
  usage: 'tool deploy [OPTIONS] TARGET',
  flags: [
    { name: '--env', description: 'Environment', value: { name: 'string', suggest: () => values('dev', 'prod') } },
    { name: '--tag', description: 'Tag', value: { name: 'string' } },
    { name: '--file', description: 'File', value: { name: 'path', suggest: () => ({ kind: 'files' }) } },
    { name: '--force', description: 'Force' },
    { name: '--add', description: 'Add', repeatable: true, value: { name: 'dir' } },
  ],
  positionals: (previous) => (previous.length === 0 ? values('api', 'web') : { kind: 'files' }),
};

const root: CommandSpec = {
  usage: 'tool [OPTIONS] COMMAND',
  flags: [{ name: '--verbose', aliases: ['-v'], description: 'Verbose' }],
  commands: () => [
    { name: 'deploy', description: 'Deploy', group: 'Commands', spec: deploy, asFlag: true },
    { name: 'status', description: 'Status', group: 'Commands', spec: { usage: 'tool status' } },
  ],
};

describe('complete', () => {
  it('suggests commands at the first position, filtered by prefix', () => {
    expect(complete(root, [''])).toEqual(values('deploy', 'status'));
    expect(complete(root, ['de'])).toEqual(values('deploy'));
  });

  it('treats an empty word list as completing an empty word', () => {
    expect(complete(root, [])).toEqual(values('deploy', 'status'));
  });

  it('suggests flags and --<command> forms when the word starts with a dash', () => {
    expect(complete(root, ['--'])).toEqual(values('--deploy', '--verbose'));
    expect(complete(root, ['-'])).toEqual(values('--deploy', '--verbose', '-v'));
  });

  it('descends into a command given as a word, as a --<command> flag, or after a global flag', () => {
    expect(complete(root, ['deploy', ''])).toEqual(values('api', 'web'));
    expect(complete(root, ['--deploy', ''])).toEqual(values('api', 'web'));
    expect(complete(root, ['-v', 'deploy', ''])).toEqual(values('api', 'web'));
  });

  it('suggests the values of a flag that takes one', () => {
    expect(complete(root, ['deploy', '--env', ''])).toEqual(values('dev', 'prod'));
    expect(complete(root, ['deploy', '--env', 'p'])).toEqual(values('prod'));
  });

  it('suggests nothing for a flag value without suggestions', () => {
    expect(complete(root, ['deploy', '--tag', ''])).toEqual(values());
  });

  it('asks for file completion when a flag value is a path', () => {
    expect(complete(root, ['deploy', '--file', ''])).toEqual({ kind: 'files' });
  });

  it('skips the value of a flag when walking the words', () => {
    expect(complete(root, ['deploy', '--env', 'dev', ''])).toEqual(values('api', 'web'));
  });

  it('hides flags already used, except repeatable ones', () => {
    expect(complete(root, ['deploy', '--force', '--add', 'x', '--'])).toEqual(
      values('--env', '--tag', '--file', '--add'),
    );
  });

  it('moves to the next positional after one is given', () => {
    expect(complete(root, ['deploy', 'api', ''])).toEqual({ kind: 'files' });
    expect(complete(root, ['deploy', 'api', 'status', ''])).toEqual({ kind: 'files' });
    expect(complete(root, ['deploy', 'api', '--f'])).toEqual(values('--file', '--force'));
  });

  it('ignores unknown flags when walking the words', () => {
    expect(complete(root, ['deploy', '--unknown', ''])).toEqual(values('api', 'web'));
  });

  it('gives the positionals the word being typed', () => {
    const spec: CommandSpec = {
      usage: 'x',
      positionals: (_previous, current) => values(...(current.includes(':') ? ['a:1', 'a:2'] : ['a', 'b'])),
    };
    expect(complete(spec, ['a:'])).toEqual(values('a:1', 'a:2'));
    expect(complete(spec, [''])).toEqual(values('a', 'b'));
  });

  it('suggests nothing for a command without flags, commands or positionals', () => {
    expect(complete(root, ['status', ''])).toEqual(values());
    expect(complete(root, ['status', '-'])).toEqual(values());
  });

  it('suggests nothing after a terminal flag such as --help', () => {
    const spec: CommandSpec = {
      ...deploy,
      flags: [...(deploy.flags ?? []), { name: '--help', aliases: ['-h'], description: '', terminal: true }],
    };
    expect(complete(spec, ['--help', ''])).toEqual(values());
    expect(complete(spec, ['--force', '-h', '--'])).toEqual(values());
  });

  it('shows the flags on an empty word when nothing else fits', () => {
    const task: CommandSpec = { usage: 'tool run [TASK...]', flags: deploy.flags ?? [] };
    expect(complete(task, ['--force', ''])).toEqual(values('--env', '--tag', '--file', '--add'));
    expect(complete({ ...task, flags: [{ name: '--help', aliases: ['-h'], description: '' }] }, [''])).toEqual(
      values('--help', '-h'),
    );
    expect(complete(task, ['x'])).toEqual(values());
  });

  it('offers commands instead of files when both apply at the first position', () => {
    const spec: CommandSpec = { ...root, positionals: () => ({ kind: 'files' }) };
    expect(complete(spec, ['s'])).toEqual(values('status'));
    expect(complete({ usage: 'x', positionals: () => ({ kind: 'files' }) }, [''])).toEqual({ kind: 'files' });
  });

  it('walks words through a command without flags, and through nested commands', () => {
    expect(complete(root, ['status', 'x', ''])).toEqual(values());
    const nested: CommandSpec = {
      usage: 'tool',
      commands: () => [{ name: 'remote', description: '', group: 'Commands', spec: root }],
    };
    expect(complete(nested, ['remote', 'deploy', ''])).toEqual(values('api', 'web'));
  });

  it('accepts --<command> only for commands marked asFlag', () => {
    expect(complete(root, ['--status', ''])).toEqual(values('deploy', 'status'));
  });
});

describe('formatSuggestions', () => {
  it('prints one value per line, or the files marker', () => {
    expect(formatSuggestions(values('a', 'b c'))).toBe('a\nb c');
    expect(formatSuggestions({ kind: 'files' })).toBe(FILES_MARKER);
    expect(FILES_MARKER).toBe(':files');
  });
});

describe('describe', () => {
  it('returns the summary of the deepest command named, or the CLI description', () => {
    const spec: CommandSpec = { ...root, description: 'The tool.' };
    expect(describeCommand(spec, [])).toBe('The tool.');
    expect(describeCommand(spec, ['-v', 'deploy', '--env', 'dev'])).toBe('Deploy');
    expect(describeCommand(spec, ['--deploy'])).toBe('Deploy');
    expect(describeCommand(root, ['nothing'])).toBe('');
  });
});
