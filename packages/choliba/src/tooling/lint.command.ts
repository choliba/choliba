import type { CommandEntry, ShellCommand, Suggestions } from '@choliba/core';

import { TOOLS } from './tooling.constants';

/** Completes file names. */
const FILES = (): Suggestions => ({ kind: 'files' });

/** How `choliba --help` lists `lint`; its own `--help` is the tool's. */
const ENTRY: CommandEntry = {
  name: 'lint',
  description: 'ESLint na pasta de trabalho, com a configuração que vem no choliba',
  group: 'Commands',
  spec: {
    usage: 'choliba lint [ESLINT_ARGS]',
    description:
      'Roda o ESLint na pasta de trabalho, com a configuração que o setup liga, e devolve o código de saída do ESLint.',
    positionals: FILES,
    examples: [
      { description: 'Confere a pasta de trabalho', command: 'choliba lint' },
      { description: 'Corrige o que dá para corrigir sozinho', command: 'choliba lint --fix' },
    ],
    details:
      'Roda o ESLint com a configuração que o `choliba setup` liga no `eslint.config.js` da pasta de trabalho ' +
      '(`choliba/eslint`). Todo argumento, `--help` inclusive, vai para o ESLint, e o código de saída é o dele.',
  },
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
