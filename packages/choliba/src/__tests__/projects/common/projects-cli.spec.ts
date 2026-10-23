import { baseShell, type CommandSpec, type ShellCommand, type ShellModule } from '@choliba/shell';
import { fakePlatform } from '@choliba/kernel/testing';
import { runShell, VERBS_ROOT } from '@choliba/shell/testing';

import { programOf } from '../../../projects';
import { runSubcommand } from '../../../projects/projects-cli';

const SPEC: CommandSpec = {
  usage: 'choliba run internal [OPTIONS]',
  flags: [{ name: '--help', description: 'Mostra esta ajuda', terminal: true }],
};

async function run(args: readonly string[], body: (args: readonly string[]) => void) {
  const command: ShellCommand = {
    verb: 'run',
    name: 'internal',
    help: () => [],
    run: (_container, io) => {
      runSubcommand(io, ['run', 'internal'], () => SPEC, body);
      return Promise.resolve();
    },
  };
  const module: ShellModule = { name: 'projects-cli-test', commands: [command] };
  const platform = fakePlatform({ argv: [...args] });
  const code = await runShell([baseShell, module, VERBS_ROOT], platform);
  return { code, platform };
}

describe('projects CLI helpers', () => {
  it('builds the command path from choliba and its segments', () => {
    expect(programOf(['list', 'projects'])).toBe('choliba list projects');
  });

  it('prints the help and skips the command body when requested', async () => {
    const body = jest.fn();
    const { code, platform } = await run(['run', 'internal', '--help'], body);

    expect(code).toBe(0);
    expect(platform.stdout.text()).toContain('Usage:  choliba run internal [OPTIONS]');
    expect(body).not.toHaveBeenCalled();
  });

  it('passes the remaining arguments to the command body', async () => {
    const received: string[][] = [];
    const { code } = await run(['run', 'internal', 'one', 'two'], (args) => {
      received.push([...args]);
    });

    expect(code).toBe(0);
    expect(received).toEqual([['one', 'two']]);
  });

  it('reports command-body errors through the shell', async () => {
    const { code, platform } = await run(['run', 'internal'], () => {
      throw new Error('falhou');
    });

    expect(code).toBe(1);
    expect(platform.stderr.text()).toContain('falhou');
  });
});
