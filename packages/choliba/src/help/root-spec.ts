import type { RootSpec } from '@choliba/core';

/** The flag every command takes, removed from the command line before any of them sees it. */
const GLOBAL_FLAGS = [
  { name: '--no-color', description: 'Saída sem cores (vale para todo comando; NO_COLOR=1 também)' },
  { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  { name: '--version', description: 'Mostra a versão do choliba', terminal: true },
];

/** `choliba --help` without its commands, which register themselves (`@RegisterHelp()`). */
export const CHOLIBA_ROOT: RootSpec = {
  usage: 'choliba COMMAND [ARGS]',
  description:
    'Testes E2E multiprojeto com Playwright, operados por agentes. Roda na pasta de trabalho: a pasta cujo ' +
    'package.json depende de choliba, com o .env, os agentes (.choliba/agents/), as skills ' +
    '(.choliba/skills/) e os MCPs (.choliba/mcps/).',
  flags: GLOBAL_FLAGS,
  footer: "Run 'choliba COMMAND --help' for more information on a command.",
};
