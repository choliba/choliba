import { createShell, PLATFORM, token, type CommandEntry, type ShellModule } from '../..';
import { fakePlatform } from '../../testing';

const GREETING = token<string>('greeting');

function entry(name: string): CommandEntry {
  return { name, description: `faz ${name}`, group: 'Commands', spec: { usage: `demo ${name}` } };
}

/** A package with a service and a command that greets whoever its first argument names. */
const greeter: ShellModule = {
  name: 'greeter',
  provide: (container) => {
    container.provide(GREETING, (c) => `olá de ${c.get(PLATFORM).cwd}`);
  },
  commands: [
    {
      name: 'hello',
      aliases: ['hi'],
      help: () => [entry('hello')],
      run: (container, io) => {
        io.write(`${container.get(GREETING)}, ${io.args().slice(1).join(' ')}\n`);
        return Promise.resolve();
      },
    },
  ],
};

describe('createShell', () => {
  it('runs the command the first word names, with the services of its package', async () => {
    const platform = fakePlatform({ argv: ['hello', 'mundo'], cwd: '/ws' });

    await expect(createShell(platform, [greeter]).run()).resolves.toBe(0);
    expect(platform.stdout.text()).toBe('olá de /ws, mundo\n');
  });

  it('knows its commands by name and alias, and nothing else', () => {
    const shell = createShell(fakePlatform(), [greeter]);

    expect(shell.has('hello')).toBe(true);
    expect(shell.has('hi')).toBe(true);
    expect(shell.has('agents')).toBe(false);
    expect(shell.has(undefined)).toBe(false);
  });

  it('runs a command by its alias', async () => {
    const platform = fakePlatform({ argv: ['hi', 'x'] });

    await expect(createShell(platform, [greeter]).run()).resolves.toBe(0);
    expect(platform.stdout.text()).toBe('olá de /nowhere, x\n');
  });

  it('gives the exit code the command chose', async () => {
    const exits: ShellModule = {
      name: 'exits',
      commands: [
        {
          name: 'exit',
          run: (_container, io) => {
            io.exit(3);
            return Promise.resolve();
          },
        },
      ],
    };

    await expect(createShell(fakePlatform({ argv: ['exit'] }), [exits]).run()).resolves.toBe(3);
  });

  it('turns what a command throws into its message on stderr and exit code 1', async () => {
    const platform = fakePlatform({ argv: ['boom'] });
    const throwing: ShellModule = {
      name: 'throwing',
      commands: [{ name: 'boom', run: () => Promise.reject(new Error('estourou')) }],
    };

    await expect(createShell(platform, [throwing]).run()).resolves.toBe(1);
    expect(platform.stderr.text()).toBe('estourou\n');
  });

  it('refuses to run a command line its table does not have', async () => {
    await expect(createShell(fakePlatform({ argv: [] }), [greeter]).run()).rejects.toThrow(
      'a linha de comando não começa com um comando da tabela: ',
    );
    await expect(createShell(fakePlatform({ argv: ['agents', 'x'] }), [greeter]).run()).rejects.toThrow(
      'a linha de comando não começa com um comando da tabela: agents x',
    );
  });

  it('lists the help entries in module order, skipping commands without help and help that throws', () => {
    const more: ShellModule = {
      name: 'more',
      commands: [
        { name: 'silent', run: () => Promise.resolve() },
        {
          name: 'broken',
          help: () => {
            throw new Error('não leu a pasta');
          },
          run: () => Promise.resolve(),
        },
        { name: 'bye', help: () => [entry('bye')], run: () => Promise.resolve() },
      ],
    };

    expect(
      createShell(fakePlatform(), [greeter, more])
        .entries()
        .map((each) => each.name),
    ).toEqual(['hello', 'bye']);
  });

  it('refuses two modules claiming the same first word', () => {
    const clash: ShellModule = { name: 'clash', commands: [{ name: 'hi', run: () => Promise.resolve() }] };

    expect(() => createShell(fakePlatform(), [greeter, clash])).toThrow('o comando hi está em greeter e em clash.');
  });

  it('gives the platform to every service, through its token', () => {
    const platform = fakePlatform();

    expect(createShell(platform, []).container.get(PLATFORM)).toBe(platform);
  });

  describe('fallback', () => {
    const agents: ShellModule = {
      name: 'agents',
      commands: [],
      fallback: (container, io) => {
        if (io.args()[0] === 'quebrado') return Promise.reject(new Error('agente quebrado'));
        io.write(`${container.get(GREETING)}: ${io.args().join(' ')}\n`);
        io.exit(4);
        return Promise.resolve();
      },
    };

    it('runs a word that is no command with the whole command line, on the services of the shell', async () => {
      const platform = fakePlatform({ argv: ['--help'] });
      const shell = createShell(platform, [greeter, agents]);

      await expect(shell.fallback?.runUnknown(['revisor', 'faça', 'isto'])).resolves.toBe(4);
      expect(platform.stdout.text()).toBe('olá de /nowhere: revisor faça isto\n');
    });

    it('turns what the fallback throws into its message on stderr and exit code 1', async () => {
      const platform = fakePlatform();

      await expect(createShell(platform, [greeter, agents]).fallback?.runUnknown(['quebrado'])).resolves.toBe(1);
      expect(platform.stderr.text()).toBe('agente quebrado\n');
    });

    it('has none when no module has one', () => {
      expect(createShell(fakePlatform(), [greeter]).fallback).toBeUndefined();
    });

    it('refuses two modules claiming the words that are no command', () => {
      expect(() => createShell(fakePlatform(), [agents, { ...agents, name: 'outro' }])).toThrow(
        'mais de um módulo trata a palavra que não é comando: agents, outro.',
      );
    });
  });
});
