import type { CommandSpec } from '@choliba/core/cli';

import { NEW_HELP } from '../new/new.help';

/** `choliba-cli --help`. */
export const CLI_HELP: CommandSpec = {
  usage: 'choliba-cli COMMAND [ARGS]',
  description:
    'Assistente para começar com o choliba: cria a pasta de trabalho, instala o choliba e os agentes. Depois, o ' +
    'trabalho do dia a dia é com o `choliba` dessa pasta.\n\n' +
    'Exemplo:\n' +
    '  choliba-cli new minha-pasta',
  commands: () => [
    { name: 'new', description: 'Cria uma pasta de trabalho do choliba', group: 'Commands', spec: NEW_HELP },
  ],
  flags: [
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
    { name: '--version', description: 'Mostra a versão do choliba-cli', terminal: true },
  ],
  footer: "Run 'choliba-cli COMMAND --help' for more information on a command.",
};
