import { createShell, type CommandEntry, type ShellModule, type ShellRoot } from '../..';
import { fakePlatform, VERBS_ROOT } from '../../testing';

const ROOT: ShellRoot = {
  spec: { usage: 'demo COMMAND [ARGS]', description: 'Uma CLI de exemplo.' },
  version: () => 'demo 1.2.3',
};

function entry(name: string, description: string): CommandEntry {
  return {
    name,
    description,
    group: 'Commands',
    spec: { usage: `demo ${name}`, flags: [{ name: '--fast', description: 'Rápido' }] },
  };
}

function command(name: string, description: string): ShellModule['commands'][number] {
  return { name, help: () => [entry(name, description)], run: () => Promise.resolve() };
}

const commands: ShellModule = {
  name: 'commands',
  root: ROOT,
  commands: [command('build', 'Monta o projeto'), command('serve', 'Sobe o servidor')],
};

async function demo(
  argv: readonly string[],
  modules: readonly ShellModule[] = [commands],
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: [...argv] });
  const code = await createShell(platform, modules).run();
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('the shell root', () => {
  it('prints the help with the commands, in the order they were registered', async () => {
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      const { code, out } = await demo(argv);

      expect(code).toBe(0);
      expect(out).toContain('Usage:  demo COMMAND [ARGS]');
      expect(out).toContain('Uma CLI de exemplo.');
      expect(out.indexOf('build')).toBeLessThan(out.indexOf('serve'));
      expect(out).toContain('Monta o projeto');
    }
  });

  it('prints the version for version and --version', async () => {
    expect(await demo(['--version'])).toEqual({ code: 0, out: 'demo 1.2.3\n', err: '' });
    expect(await demo(['version'])).toEqual({ code: 0, out: 'demo 1.2.3\n', err: '' });
  });

  it('is a usage error that suggests the closest command', async () => {
    expect(await demo(['revisor'])).toEqual({
      code: 1,
      out: '',
      err: "comando desconhecido: revisor.\nRun 'demo --help' for usage.\n",
    });
    expect((await demo(['biuld'])).err).toBe(
      'comando desconhecido: biuld. Você quis dizer "build"?\nRun \'demo --help\' for usage.\n',
    );
  });

  it('prints the help of the command help names, and refuses one it does not have', async () => {
    const { code, out } = await demo(['help', 'build']);

    expect(code).toBe(0);
    expect(out).toContain('Usage:  demo build');
    expect(out).toContain('--fast');
    const unknown = await demo(['help', 'nada']);
    expect(unknown.code).toBe(1);
    expect(unknown.err).toContain('comando desconhecido: nada.');
  });

  describe('verbs', () => {
    const ran: string[][] = [];
    const verbs: ShellModule = {
      name: 'verbs',
      root: { ...ROOT, verbs: [{ name: 'run', description: 'Roda um alvo' }] },
      commands: [
        command('build', 'Monta o projeto'),
        {
          verb: 'run',
          name: 'agent',
          help: () => [entry('agent', 'Um agente')],
          run: (_container, io) => {
            ran.push([...io.args('run', 'agent')]);
            io.exit(5);
            return Promise.resolve();
          },
        },
        { verb: 'run', name: 'tests', help: () => [entry('tests', 'Os testes')], run: () => Promise.resolve() },
      ],
    };

    it('runs the type the second word names, with its arguments', async () => {
      expect((await demo(['run', 'agent', 'revisor', 'x'], [verbs])).code).toBe(5);
      expect(ran.at(-1)).toEqual(['revisor', 'x']);
    });

    it('lists the verb with the commands, and its types in its own help', async () => {
      const root = await demo(['--help'], [verbs]);
      const help = await demo(['run', '--help'], [verbs]);

      expect(root.out).toContain('Roda um alvo');
      expect(help).toMatchObject({ code: 0, err: '' });
      expect(help.out).toContain('Usage:  demo run TYPE [ARGS]');
      expect(help.out).toContain('Um agente');
      expect(help.out).toContain('Os testes');
      expect((await demo(['help', 'run', 'agent'], [verbs])).out).toContain('Usage:  demo agent');
    });

    it('is a usage error without a type or with an unknown one, suggesting the closest', async () => {
      expect(await demo(['run'], [verbs])).toEqual({
        code: 1,
        out: '',
        err: "falta o tipo: agent ou tests.\nRun 'demo run --help' for usage.\n",
      });
      expect((await demo(['run', 'test'], [verbs])).err).toBe(
        'tipo desconhecido: test. Você quis dizer "tests"?\nRun \'demo run --help\' for usage.\n',
      );
    });

    it('completes the verb, then its types, then what each type takes', async () => {
      expect((await demo(['__complete', ''], [verbs])).out).toBe('build\nrun\nhelp\nversion\n');
      expect((await demo(['__complete', 'run', ''], [verbs])).out).toBe('agent\ntests\n');
      expect((await demo(['__complete', 'run', 'agent', '--f'], [verbs])).out).toBe('--fast\n');
    });
  });

  it('lists nothing when the root has no commands', async () => {
    const { code, out } = await demo(['__entries'], [{ name: 'empty', root: ROOT, commands: [] }]);

    expect(code).toBe(0);
    expect(out).toBe('[]\n');
  });

  it('gives the listed commands as JSON, leaving out the ones that are not listed', async () => {
    const hidden: ShellModule = {
      name: 'hidden',
      root: ROOT,
      commands: [
        command('build', 'Monta o projeto'),
        {
          name: 'revisor',
          help: () => [{ ...entry('revisor', 'Um agente'), listed: false }],
          run: () => Promise.resolve(),
        },
      ],
    };

    const { out } = await demo(['__entries'], [hidden]);

    expect(JSON.parse(out)).toEqual([{ name: 'build', description: 'Monta o projeto', group: 'Commands' }]);
  });

  it('completes and describes from the commands', async () => {
    expect((await demo(['__complete', ''])).out).toBe('build\nserve\nhelp\nversion\n');
    expect((await demo(['__complete', 'build', '--f'])).out).toBe('--fast\n');
    expect((await demo(['__describe', 'serve'])).out).toBe('Sobe o servidor\n');
  });

  it('prints a delegated completion, and completes locally when the delegate declines', async () => {
    const delegated: ShellModule = { ...commands, root: { ...ROOT, delegateComplete: () => ':files\n' } };
    const local: ShellModule = { ...commands, root: { ...ROOT, delegateComplete: () => undefined } };

    expect((await demo(['__complete', 'agents', ''], [delegated])).out).toBe(':files\n');
    expect((await demo(['__complete', ''], [local])).out).toBe('build\nserve\nhelp\nversion\n');
  });

  it('sorts the entries by the sections and the order the root names', async () => {
    const layout: ShellModule = {
      name: 'layout',
      root: { ...ROOT, groups: ['Commands', 'Agents'], order: ['serve', 'deploy', 'build'] },
      commands: [
        command('build', 'Monta o projeto'),
        command('serve', 'Sobe o servidor'),
        {
          name: 'deploy',
          help: () => [entry('deploy', 'Publica')],
          run: () => Promise.resolve(),
        },
        {
          name: 'revisor',
          help: () => [{ ...entry('revisor', 'Um agente'), group: 'Agents' }],
          run: () => Promise.resolve(),
        },
      ],
    };

    const { out } = await demo(['__entries'], [layout]);

    expect((JSON.parse(out) as { name: string }[]).map(({ name }) => name)).toEqual([
      'serve',
      'deploy',
      'build',
      'revisor',
    ]);
  });

  it('leaves out a command whose help throws', async () => {
    const broken: ShellModule = {
      name: 'broken',
      root: ROOT,
      commands: [
        command('build', 'Monta o projeto'),
        {
          name: 'gone',
          help: () => {
            throw new Error('sem pasta de trabalho');
          },
          run: () => Promise.resolve(),
        },
      ],
    };

    const { code, out } = await demo(['--help'], [broken]);

    expect(code).toBe(0);
    expect(out).toContain('Monta o projeto');
    expect(out).not.toContain('gone');
  });

  it('gives specs a root with the verbs of the app', async () => {
    expect(await demo(['version'], [VERBS_ROOT])).toEqual({ code: 0, out: 'choliba 0.0.0\n', err: '' });
    expect((await demo(['__complete', ''], [VERBS_ROOT])).out).toBe('run\nnew\nlist\nhelp\nversion\n');
  });

  it('refuses two modules defining the root', () => {
    expect(() => createShell(fakePlatform(), [commands, { name: 'outro', root: ROOT, commands: [] }])).toThrow(
      'mais de um módulo define a raiz: commands, outro.',
    );
  });
});
