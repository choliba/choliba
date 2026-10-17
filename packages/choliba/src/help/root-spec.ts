import type { RootSpec, ShellVerb } from '@choliba/core';

/** The flag every command takes, removed from the command line before any of them sees it. */
const GLOBAL_FLAGS = [
  { name: '--no-color', description: 'Saída sem cores (vale para todo comando; NO_COLOR=1 também)' },
  { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
  { name: '--version', description: 'Mostra a versão do choliba', terminal: true },
];

/** `choliba --help` without its commands: each command's `help` supplies those. */
export const CHOLIBA_ROOT: RootSpec = {
  usage: 'choliba COMMAND [ARGS]',
  description:
    'Testes E2E multiprojeto com Playwright, operados por agentes. Roda na pasta de trabalho: a pasta cujo ' +
    'package.json depende de choliba, com o .env, os agentes (.choliba/agents/), as skills ' +
    '(.choliba/skills/) e os MCPs (.choliba/mcps/).',
  flags: GLOBAL_FLAGS,
  footer: "Run 'choliba COMMAND --help' for more information on a command.",
};

/** The order of `choliba --help`'s commands, by name. Names missing here come after, as they were registered. */
export const CHOLIBA_ORDER: readonly string[] = [
  'run',
  'add',
  'new',
  'list',
  'check',
  'panel',
  'setup',
  'update',
  'lint',
  'format',
];

/** The verbs of the root: each package registers its types under them (`run agent`, `run tests`, `new project`…). */
export const CHOLIBA_VERBS: readonly ShellVerb[] = [
  {
    name: 'run',
    description: 'Roda um agente ou os testes',
    examples: [
      {
        description: 'Implementa o ticket loja-1',
        command: 'choliba run agent implementer --project loja --ticket loja-1',
      },
      { description: 'Roda os testes do projeto loja', command: 'choliba run tests loja' },
    ],
  },
  {
    name: 'new',
    description: 'Cria um projeto a partir do modelo',
    examples: [
      {
        description: 'Cria o projeto loja para a aplicação em ./app',
        command: 'choliba new project loja --app-dir ./app',
      },
    ],
  },
  {
    name: 'list',
    description: 'Lista os agentes, os projetos ou a configuração',
    examples: [
      { description: 'Lista os agentes instalados', command: 'choliba list agents' },
      { description: 'Mostra a configuração em vigor e de onde vem cada valor', command: 'choliba list config' },
      { description: 'Lista os projetos com os tickets de cada um', command: 'choliba list projects --tickets' },
    ],
  },
  {
    name: 'set',
    description: 'Grava uma chave da configuração no .env',
    examples: [{ description: 'Roda o provider num container', command: 'choliba set config CHOL_SANDBOX docker' }],
  },
];
