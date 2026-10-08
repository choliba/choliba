import type { CommandSpec } from '@choliba/core';

import { ACCESS, ACCESS_LABELS, DEFAULT_MODELS } from './agent-options';

/** `choliba-cli agent new --help`. */
export const AGENT_NEW_HELP: CommandSpec = {
  usage: 'choliba-cli agent new [NOME] [OPTIONS]',
  description:
    'Cria um agente novo na pasta de trabalho (.choliba/agents/<nome>/agent.yaml), já válido, com CHANGE_ME onde ' +
    'você escreve o texto dele, e confere com `choliba check`. O que não vier nas opções é perguntado.\n\n' +
    'Exemplos:\n' +
    '  choliba-cli agent new revisor\n' +
    '  choliba-cli agent new revisor --description "Revisa o código" --role "Você revisa código." --project --access leitura --no-input',
  flags: [
    { name: '--description', description: 'O que ele faz, numa frase', value: { name: 'texto' } },
    { name: '--role', description: 'Quem ele é, numa frase (o papel)', value: { name: 'texto' } },
    {
      name: '--models',
      description: `Modelos, separados por vírgula (padrão: ${DEFAULT_MODELS.join(', ')})`,
      value: { name: 'modelos' },
    },
    { name: '--project', description: 'Age sobre um projeto (recebe --project ao rodar)' },
    { name: '--no-project', description: 'Não age sobre um projeto' },
    {
      name: '--access',
      description: 'O que ele pode fazer no projeto (padrão: leitura)',
      value: { name: 'acesso' },
      choices: ACCESS.map((name) => ({ name, description: ACCESS_LABELS[name] })),
    },
    { name: '--no-input', description: 'Não pergunta nada: usa as opções e os padrões' },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};

/** `choliba-cli agent --help`. */
export const AGENT_HELP: CommandSpec = {
  usage: 'choliba-cli agent COMMAND [ARGS]',
  description: 'Agentes da pasta de trabalho.',
  commands: () => [{ name: 'new', description: 'Cria um agente novo', group: 'Commands', spec: AGENT_NEW_HELP }],
  footer: "Run 'choliba-cli agent COMMAND --help' for more information on a command.",
};
