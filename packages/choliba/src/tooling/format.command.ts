import type { CommandEntry, ShellCommand, Suggestions } from '@choliba/shell';

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
    description:
      'Roda o Prettier na pasta de trabalho: confere a formatação, ou corrige com --write, e devolve o código de saída dele.',
    flags: [{ name: '--write', description: 'Corrige em vez de só conferir' }],
    positionals: FILES,
    examples: [
      { description: 'Confere a formatação da pasta de trabalho', command: 'choliba format' },
      { description: 'Corrige a formatação', command: 'choliba format --write' },
    ],
    details:
      'Roda o Prettier com o `.prettierrc.json` e o `.editorconfig` da pasta de trabalho. Todo argumento, `--help` ' +
      'inclusive, vai para o Prettier, e o código de saída é o dele.',
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
