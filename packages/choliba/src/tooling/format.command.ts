import type { CommandEntry, ShellCommand, Suggestions } from '@choliba/core';

import { TOOLS } from './tooling.constants';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `format`; its own `--help` is the tool's. */
const ENTRY: CommandEntry = {
  name: 'format',
  description: 'Prettier na pasta de trabalho: confere, ou corrige com --write',
  group: 'Commands',
  spec: {
    usage: 'choliba format [--write] [PATHS...]',
    flags: [{ name: '--write', description: 'Corrige em vez de só conferir' }],
    positionals: FILES,
  },
};

/** `choliba format [--write] [PATHS...]`: every argument goes on to Prettier; its exit code is choliba's. */
export const formatCommand: ShellCommand = {
  name: 'format',
  help: () => [ENTRY],
  run: (container, io) => {
    io.exit(container.get(TOOLS).format(io.args('format')));
    return Promise.resolve();
  },
};
