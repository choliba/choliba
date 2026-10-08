import type { CommandSpec } from '@choliba/core';

import { ACCESS, ACCESS_LABELS, DEFAULT_MODELS } from './agent-options';

/** `choliba generate agent --help`. */
export const GENERATE_AGENT_HELP: CommandSpec = {
  usage: 'choliba generate agent [NOME] [OPTIONS]',
  description:
    'Cria um agente novo na pasta de trabalho (.choliba/agents/<nome>/agent.yaml), já válido, com CHANGE_ME onde ' +
    'você escreve o texto dele, e confere com `choliba check`. O que não vier nas opções é perguntado.\n\n' +
    'Exemplos:\n' +
    '  choliba generate agent revisor\n' +
    '  choliba generate agent revisor --description "Revisa o código" --role "Você revisa código." --project --access leitura --no-input',
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

/** `choliba generate project --help`. */
export const GENERATE_PROJECT_HELP: CommandSpec = {
  usage: 'choliba generate project [PROJECT] --app-dir DIR [OPTIONS]',
  description: 'Cria um projeto novo a partir do template',
  positionals: () => ({ kind: 'values', values: [] }),
  flags: [
    {
      name: '--app-dir',
      description:
        'Pasta com o código da aplicação (obrigatória): precisa existir; relativa ao diretório atual. Sem PROJECT, o projeto leva o nome dela; o README na raiz dela vira o description',
      value: { name: 'dir', suggest: () => ({ kind: 'files' }) },
    },
    { name: '--base-url', description: 'URL base do projeto', value: { name: 'url' } },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};

/** `choliba generate ticket --help`, with the ticket types of the templates. */
export function generateTicketHelp(types: readonly string[]): CommandSpec {
  return {
    usage: 'choliba generate ticket PROJECT TYPE',
    description: `Cria um ticket a partir do template do tipo (${types.join(', ')}), no ambiente ativo do projeto`,
    flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
  };
}

/** `choliba generate --help`: what it generates. */
export function generateHelp(ticketTypes: readonly string[]): CommandSpec {
  return {
    usage: 'choliba generate TYPE [ARGS]',
    description: 'Gera uma peça da pasta de trabalho: um agente, um projeto de teste ou um ticket.',
    commands: () => [
      { name: 'agent', description: 'Cria um agente novo', group: 'Commands', spec: GENERATE_AGENT_HELP },
      { name: 'project', description: 'Cria um projeto de teste', group: 'Commands', spec: GENERATE_PROJECT_HELP },
      { name: 'ticket', description: 'Cria um ticket', group: 'Commands', spec: generateTicketHelp(ticketTypes) },
    ],
    flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
    footer: "Run 'choliba generate TYPE --help' for more information on a type.",
  };
}
