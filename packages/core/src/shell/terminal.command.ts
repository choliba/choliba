import { parseRunArgs, ProcessRunnerService, TerminalService } from '../terminal';
import { token, type Container } from './container';
import { PLATFORM } from './create-shell';
import type { ShellCommand } from './interfaces/shell.interface';
import { THEME } from './shell.constants';

const RUNNER = token<ProcessRunnerService>('ProcessRunnerService');
const TERMINAL = token<TerminalService>('TerminalService');

/** `choliba terminal run --label <name> -- <command…>`: hidden, for scripts that label a process's output. */
export const terminalCommand: ShellCommand = {
  name: 'terminal',
  async run(container, io) {
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
