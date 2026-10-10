import { PLATFORM, THEME, token, type ShellCommand, type ShellModule } from '@choliba/core';

import { parseRunArgs } from './dto/run.dto';
import { ProcessRunnerService } from './process-runner.service';
import { TerminalService } from './terminal.service';

const RUNNER = token<ProcessRunnerService>('ProcessRunnerService');
const TERMINAL = token<TerminalService>('TerminalService');

/** `choliba terminal run --label <name> -- <command…>`: hidden, for scripts that label a process's output. */
const terminalRun: ShellCommand = {
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

/** The commands of @choliba/terminal in the shell. `terminal run` no longer starts Nest. */
export const terminalShell: ShellModule = {
  name: '@choliba/terminal',
  provide: (container) => {
    container.provide(RUNNER, (c) => new ProcessRunnerService({ spawner: c.get(PLATFORM).spawn }));
    container.provide(TERMINAL, (c) => {
      const { stdout, stderr, signals } = c.get(PLATFORM);
      return new TerminalService(c.get(RUNNER), c.get(THEME), stdout, stderr, signals);
    });
  },
  commands: [terminalRun],
};
