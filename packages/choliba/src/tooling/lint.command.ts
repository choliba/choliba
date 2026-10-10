import type { CommandEntry, ShellCommand, Suggestions } from '@choliba/core';

import { TOOLS } from './tooling.constants';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `lint`; its own `--help` is the tool's. */
const ENTRY: CommandEntry = {
  name: 'lint',
  description: 'ESLint na pasta de trabalho, com a configuração que vem no choliba',
  group: 'Commands',
  spec: { usage: 'choliba lint [ESLINT_ARGS]', positionals: FILES },
};

/** `choliba lint [ESLINT_ARGS]`: every argument, `--help` included, goes on to ESLint; its exit code is choliba's. */
export const lintCommand: ShellCommand = {
  name: 'lint',
  help: () => [ENTRY],
  run: (container, io) => {
    io.exit(container.get(TOOLS).lint(io.args('lint')));
    return Promise.resolve();
  },
};
