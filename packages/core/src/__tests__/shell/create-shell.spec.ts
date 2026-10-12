import { createShell, ExpectedError, PLATFORM, token, type CommandEntry, type ShellModule } from '../..';
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

  it('reports an unexpected command error as a bug and exits 1', async () => {
    const platform = fakePlatform({ argv: ['boom'] });
    const throwing: ShellModule = {
      name: 'throwing',
      commands: [{ name: 'boom', run: () => Promise.reject(new Error('estourou')) }],
    };

    await expect(createShell(platform, [throwing]).run()).resolves.toBe(1);
    expect(platform.stderr.text()).toBe(
      'erro inesperado: estourou\nisso parece ser um bug; reporte em https://github.com/choliba/choliba/issues\n',
    );
  });

  it('prints an expected error as-is and shows an unexpected stack only with CHOL_DEBUG=1', async () => {
    const expected = fakePlatform({ argv: ['boom'] });
    const debug = fakePlatform({ argv: ['boom'], env: { CHOL_DEBUG: '1' } });
    const expectedModule: ShellModule = {
      name: 'expected',
      commands: [{ name: 'boom', run: () => Promise.reject(new ExpectedError('corrija isto')) }],
    };
    const unexpectedModule: ShellModule = {
      name: 'unexpected',
      commands: [{ name: 'boom', run: () => Promise.reject(new Error('quebrou')) }],
    };

    await createShell(expected, [expectedModule]).run();
    await createShell(debug, [unexpectedModule]).run();

    expect(expected.stderr.text()).toBe('corrija isto\n');
    expect(debug.stderr.text()).toContain('Error: quebrou');
    expect(debug.stderr.text()).toContain('create-shell.spec.ts');
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

  describe('verbs', () => {
    const root = {
      spec: { usage: 'demo COMMAND' },
      version: () => 'demo 1',
      verbs: [{ name: 'run', description: 'Roda' }],
    };

    it('refuses a command under a verb the root does not have', () => {
      const stray: ShellModule = {
        name: 'stray',
        commands: [{ verb: 'make', name: 'x', run: () => Promise.resolve() }],
      };

      expect(() => createShell(fakePlatform(), [{ name: 'app', root, commands: [] }, stray])).toThrow(
        'o comando make x de stray usa um verbo que a raiz não tem.',
      );
    });

    it('refuses a verb that is also a command, and two types with one name', () => {
      const clash: ShellModule = { name: 'clash', commands: [{ name: 'run', run: () => Promise.resolve() }] };
      const one: ShellModule = { name: 'one', commands: [{ verb: 'run', name: 'x', run: () => Promise.resolve() }] };

      expect(() => createShell(fakePlatform(), [{ name: 'app', root, commands: [] }, clash])).toThrow(
        'o verbo run também é um comando.',
      );
      expect(() =>
        createShell(fakePlatform(), [{ name: 'app', root, commands: [] }, one, { ...one, name: 'two' }]),
      ).toThrow('o comando x está em one e em two.');
    });

    it('knows a verb as a first word', () => {
      expect(createShell(fakePlatform(), [{ name: 'app', root, commands: [] }]).has('run')).toBe(true);
    });
  });
});
