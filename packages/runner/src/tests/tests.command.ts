import type { CommandEntry, ShellCommand } from '@choliba/core';

import { TESTS } from './tests.constants';

/** How `choliba run --help` lists `tests`; its spec is built from the workspace when asked for. */
const ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'tests',
  description: 'Roda os testes E2E dos projetos com o Playwright',
  group: 'Commands',
};

/** `choliba run tests [PROJECT[:TICKET][/PATH]] [OPTIONS]`: its own flags and Playwright's, as typed. */
export const testsCommand: ShellCommand = {
  verb: 'run',
  name: 'tests',
  help: (container) => [{ ...ENTRY, spec: container.get(TESTS).helpSpec() }],
  run: async (container, io) => {
    const args = io.args('run', 'tests');
    if (args.some((arg) => arg === '--help' || arg === '-h')) {
      io.printHelp(container.get(TESTS).helpSpec());
      return;
    }
    io.exit(await container.get(TESTS).run(args));
  },
};
