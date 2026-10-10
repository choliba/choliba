import { createShell, type CommandEntry, type ShellModule, type ShellRoot } from '../..';
import { fakePlatform } from '../../testing';

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

  it('hands a word that is not a command to the fallback, with the whole command line', async () => {
    const seen: (readonly string[])[] = [];
    const withFallback: ShellModule = {
      ...commands,
      fallback: (_container, io) => {
        seen.push(io.args());
        io.exit(3);
        return Promise.resolve();
      },
    };

    const { code } = await demo(['revisor', 'faça', 'isto'], [withFallback]);

    expect(code).toBe(3);
    expect(seen).toEqual([['revisor', 'faça', 'isto']]);
  });

  it('reports what the fallback threw, with exit code 1', async () => {
    const withFallback: ShellModule = {
      ...commands,
      fallback: () => Promise.reject(new Error('agente quebrado')),
    };

    const { code, err } = await demo(['revisor'], [withFallback]);

    expect(code).toBe(1);
    expect(err).toBe('agente quebrado\n');
  });

  it('is a usage error when there is no fallback', async () => {
    const { code, err } = await demo(['revisor']);

    expect(code).toBe(1);
    expect(err).toBe("comando desconhecido: revisor.\nRun 'demo --help' for usage.\n");
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

  it('refuses two modules defining the root', () => {
    expect(() => createShell(fakePlatform(), [commands, { name: 'outro', root: ROOT, commands: [] }])).toThrow(
      'mais de um módulo define a raiz: commands, outro.',
    );
  });
});
