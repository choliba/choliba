import { token, type Container } from '@choliba/kernel';

import { parseRunArgs, ProcessRunnerService, TerminalService } from '../terminal';
import { PLATFORM } from './create-shell';
import type { ShellCommand } from './interfaces/shell.interface';
import type { CommandSpec } from '../help';
import { THEME } from './shell.constants';

const RUNNER = token<ProcessRunnerService>('ProcessRunnerService');
const TERMINAL = token<TerminalService>('TerminalService');

/** `choliba terminal run`: out of the root's `--help` (it is for scripts), but in the command reference. */
export const TERMINAL_RUN_SPEC: CommandSpec = {
  usage: 'choliba terminal run --label <nome> [--timestamps] -- <comando...>',
  description:
    'Roda um processo e prefixa cada linha da saída com um rótulo, para um script ver o que o processo escreveu.',
  examples: [
    {
      description: 'Rotula a saída do servidor de desenvolvimento',
      command: 'choliba terminal run --label app -- bun run dev',
    },
  ],
  details:
    'Cada linha sai com o rótulo (`choliba terminal run --label demo -- echo ok` escreve `[demo] ok`), e o código de ' +
    'saída é o do processo. Não aparece no `choliba --help`: é para scripts.',
  flags: [
    { name: '--label', description: 'Rótulo que identifica cada linha', value: { name: 'nome' } },
    { name: '--timestamps', description: 'Inclui o horário em cada linha' },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};

/** `choliba terminal run --label <name> -- <command…>`: hidden, for scripts that label a process's output. */
export const terminalCommand: ShellCommand = {
  name: 'terminal',
  async run(container, io) {
    if (io.wantsHelp(io.args('terminal', 'run'))) {
      io.printHelp(TERMINAL_RUN_SPEC);
      return;
    }
    try {
      const dto = parseRunArgs(io.args('terminal'));
      io.exit(await container.get(TERMINAL).run(dto));
    } catch (error) {
      io.fail(String(error));
    }
  },
};

/** The process runner and the terminal service, built from the platform when a command asks for them. */
export function provideTerminal(container: Container): void {
  container.provide(RUNNER, (current) => new ProcessRunnerService({ spawner: current.get(PLATFORM).spawn }));
  container.provide(TERMINAL, (current) => {
    const { stdout, stderr, signals } = current.get(PLATFORM);
    return new TerminalService(current.get(RUNNER), current.get(THEME), stdout, stderr, signals);
  });
}
