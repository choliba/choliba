import type { RootSpec } from '@choliba/core';

/** `choliba-cli --help` without its commands, which register themselves (`@RegisterHelp()`). */
export const CLI_ROOT: RootSpec = {
  usage: 'choliba-cli COMMAND [ARGS]',
  description:
    'Assistente para começar com o choliba: cria a pasta de trabalho, instala o choliba e os agentes. Depois, o ' +
    'trabalho do dia a dia é com o `choliba` dessa pasta.\n\n' +
    'Exemplo:\n' +
    '  choliba-cli new minha-pasta',
  flags: [
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
    { name: '--version', description: 'Mostra a versão do choliba-cli', terminal: true },
  ],
  footer: "Run 'choliba-cli COMMAND --help' for more information on a command.",
};
