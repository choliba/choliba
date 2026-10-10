import type { CommandEntry, ShellCommand } from '@choliba/core';

import { TESTS } from './tests.constants';

/** How `choliba --help` lists `tests`; its spec is built from the workspace when asked for. */
const ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'tests',
  description: 'Roda os testes E2E dos projetos com o Playwright',
  group: 'Commands',
};

/** `choliba tests [PROJECT[:TICKET][/PATH]] [OPTIONS]`: its own flags and Playwright's, as typed. */
export const testsCommand: ShellCommand = {
  name: 'tests',
  help: (container) => [{ ...ENTRY, spec: container.get(TESTS).helpSpec() }],
  run: async (container, io) => {
    const args = io.args('tests');
    if (args.some((arg) => arg === '--help' || arg === '-h')) {
      io.printHelp(container.get(TESTS).helpSpec());
      return;
    }
    io.exit(await container.get(TESTS).run(args));
  },
};
