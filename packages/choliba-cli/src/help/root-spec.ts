import type { RootSpec } from '@choliba/core';

/** `choliba --help` without its commands, which register themselves (`@RegisterHelp()`). */
export const CLI_ROOT: RootSpec = {
  usage: 'choliba COMMAND [ARGS]',
  description:
    'O choliba: cria a pasta de trabalho (new), gera agentes, projetos e tickets (generate) e instala agentes, ' +
    'skills e MCPs (add). Dentro de uma pasta de trabalho, os outros comandos rodam no choliba dela, na versão ' +
    'que ela instalou.\n\n' +
    'Exemplos:\n' +
    '  choliba new minha-pasta\n' +
    '  choliba generate project --app-dir ../minha-app\n' +
    '  choliba agents list',
  flags: [
    { name: '--no-color', description: 'Saída sem cores (vale para todo comando; NO_COLOR=1 também)' },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
    {
      name: '--version',
      description: 'Mostra a versão do choliba (e a da pasta de trabalho, dentro de uma)',
      terminal: true,
    },
  ],
  footer: "Run 'choliba COMMAND --help' for more information on a command.",
};
