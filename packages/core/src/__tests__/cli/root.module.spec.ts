import { Injectable, Module } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor, RootFallback, RootOptions } from '../..';
import { CliCommand, CliModule, RegisterHelp, RegisterRootFallback, RootModule } from '../../nest';
import { fakePlatform, runCommand } from '../../testing';

const ROOT: RootOptions = {
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

@RegisterHelp()
@Command({ name: 'build' })
class BuildCommand extends CliCommand implements HelpContributor {
  helpEntries(): readonly CommandEntry[] {
    return [entry('build', 'Monta o projeto')];
  }

  run(): Promise<void> {
    return Promise.resolve();
  }
}

@RegisterHelp()
@Command({ name: 'serve' })
class ServeCommand extends CliCommand implements HelpContributor {
  helpEntries(): readonly CommandEntry[] {
    return [entry('serve', 'Sobe o servidor')];
  }

  run(): Promise<void> {
    return Promise.resolve();
  }
}

/** A contributor that cannot read what it lists (a workspace that is not there): it is left out. */
@RegisterHelp()
@Injectable()
class BrokenContributor implements HelpContributor {
  helpEntries(): readonly CommandEntry[] {
    throw new Error('sem pasta de trabalho');
  }
}

@Module({ imports: [CliModule], providers: [BuildCommand, ServeCommand, BrokenContributor] })
class CommandsModule {}

function fallbackModule(run: RootFallback['runUnknown']): unknown {
  @RegisterRootFallback()
  @Injectable()
  class Fallback implements RootFallback {
    runUnknown(argv: readonly string[]): Promise<number> {
      return run(argv);
    }
  }
  @Module({ providers: [Fallback] })
  class FallbackModule {}
  return FallbackModule;
}

async function demo(
  argv: readonly string[],
  extra: unknown[] = [],
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: [...argv] });
  const code = await runCommand([RootModule.forRoot(ROOT), CommandsModule, ...(extra as never[])], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('RootModule', () => {
  it('prints the help with the registered commands, in the order the app registers them', async () => {
    for (const argv of [[], ['help'], ['--help'], ['-h']]) {
      const { code, out } = await demo(argv);

      expect(code).toBe(0);
      expect(out).toContain('Usage:  demo COMMAND [ARGS]');
      expect(out).toContain('Uma CLI de exemplo.');
      expect(out.indexOf('build')).toBeLessThan(out.indexOf('serve'));
      expect(out).toContain('Monta o projeto');
    }
  });

  it('prints the version', async () => {
    expect(await demo(['--version'])).toEqual({ code: 0, out: 'demo 1.2.3\n', err: '' });
  });

  it('hands a word that is not a command to the fallback, with the whole command line', async () => {
    const seen: (readonly string[])[] = [];
    const run = (argv: readonly string[]): Promise<number> => {
      seen.push(argv);
      return Promise.resolve(3);
    };

    const { code } = await demo(['revisor', 'faça', 'isto'], [fallbackModule(run)]);

    expect(code).toBe(3);
    expect(seen).toEqual([['revisor', 'faça', 'isto']]);
  });

  it('reports what the fallback threw, with exit code 1', async () => {
    const { code, err } = await demo(['revisor'], [fallbackModule(() => Promise.reject(new Error('agente quebrado')))]);

    expect(code).toBe(1);
    expect(err).toBe('agente quebrado\n');
  });

  it('is a usage error when there is no fallback', async () => {
    const { code, err } = await demo(['revisor']);

    expect(code).toBe(1);
    expect(err).toBe("comando desconhecido: revisor.\nRun 'demo --help' for usage.\n");
  });

  it('completes and describes from the registered commands', async () => {
    expect((await demo(['__complete', ''])).out).toBe('build\nserve\n');
    expect((await demo(['__complete', 'build', '--f'])).out).toBe('--fast\n');
    expect((await demo(['__describe', 'serve'])).out).toBe('Sobe o servidor\n');
  });
});
