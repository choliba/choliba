import type { CommandSpec } from '@choliba/core';

import { AGENTS, AGENTS_SOURCE, PROVIDERS } from './new-options';

/** `choliba new --help`. */
export const NEW_HELP: CommandSpec = {
  usage: 'choliba new [PASTA] [OPTIONS]',
  description:
    'Prepara uma pasta de trabalho do choliba: cria a pasta, instala o choliba, escolhe o provider dos agentes, ' +
    'instala os agentes do choliba e confere tudo com `choliba check`. O que não vier nas opções é perguntado.\n\n' +
    'Exemplos:\n' +
    '  choliba new minha-pasta\n' +
    '  choliba new minha-pasta --provider claude --agents product-owner,test-writer --no-input',
  flags: [
    {
      name: '--provider',
      description: 'Provider dos agentes (padrão: auto)',
      value: { name: 'provider' },
      choices: PROVIDERS.map((name) => ({ name, description: name === 'auto' ? 'o primeiro instalado' : name })),
    },
    {
      name: '--agents',
      description: `Agentes a instalar, separados por vírgula: ${AGENTS.join(', ')} (padrão: todos)`,
      value: { name: 'nomes' },
    },
    { name: '--no-agents', description: 'Não instala agentes' },
    {
      name: '--mcp-app-dir',
      description: 'Onde está o servidor mcp-app, para o product-owner (padrão: deixar para depois)',
      value: { name: 'pasta' },
    },
    { name: '--no-input', description: 'Não pergunta nada: usa as opções e os padrões' },
    {
      name: '--choliba',
      description: 'De onde instalar o choliba (padrão: a release v0.0.1-dev)',
      value: { name: 'espec' },
    },
    {
      name: '--agents-from',
      description: `De onde instalar os agentes (padrão: ${AGENTS_SOURCE})`,
      value: { name: 'origem' },
    },
    { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  ],
};
