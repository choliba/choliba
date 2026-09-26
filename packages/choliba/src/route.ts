import type { CommandEntry, CommandSpec } from '@choliba/core/cli';

/** What `choliba` runs itself; any other first word is an agent of the workspace. */
export const SUBCOMMANDS = ['agents', 'projects', 'tests', 'playwright-cli', 'setup', 'completion'] as const;

export type Subcommand = (typeof SUBCOMMANDS)[number];

export interface Route {
  readonly kind: Subcommand | 'help' | '__complete';
  /** The arguments for that subcommand, without its own name. */
  readonly argv: readonly string[];
}

function isSubcommand(word: string): word is Subcommand {
  return SUBCOMMANDS.some((subcommand) => subcommand === word);
}

/**
 * Which part of choliba a command line is for. `choliba <agent> …` is `choliba agents <agent> …`, so
 * an unknown first word goes to the agents CLI, which runs that agent or says it does not exist.
 */
export function route(argv: readonly string[]): Route {
  const [first, ...rest] = argv;
  if (first === undefined || first === 'help' || first === '--help' || first === '-h') {
    return { kind: 'help', argv: rest };
  }
  if (first === '__complete') {
    return { kind: '__complete', argv: rest };
  }
  return isSubcommand(first) ? { kind: first, argv: rest } : { kind: 'agents', argv };
}

/** What `choliba --help` lists, and what its first word completes to (with the agents). */
const COMMANDS: readonly CommandEntry[] = [
  {
    name: 'agents',
    description: 'Roda um agente da pasta de trabalho (agents/<nome>/); `choliba <agente>` é atalho',
    group: 'Commands',
    spec: { usage: 'choliba agents COMMAND [OPTIONS] [TASK...]' },
  },
  {
    name: 'projects',
    description: 'Cria e lista projetos e tickets em PROJECTS_DIR',
    group: 'Commands',
    spec: { usage: 'choliba projects COMMAND [ARGS]' },
  },
  {
    name: 'tests',
    description: 'Roda os testes E2E dos projetos com o Playwright',
    group: 'Commands',
    spec: { usage: 'choliba tests [PROJECT[:TICKET]] [OPTIONS]' },
  },
  {
    name: 'playwright-cli',
    description: 'O navegador que os agentes usam (playwright cli)',
    group: 'Commands',
    spec: { usage: 'choliba playwright-cli COMMAND [ARGS]' },
  },
  {
    name: 'setup',
    description: 'Liga o autocomplete no bash (roda sozinho ao instalar com --trust)',
    group: 'Commands',
    spec: { usage: 'choliba setup' },
  },
  {
    name: 'completion',
    description: 'Imprime o script de autocomplete do bash',
    group: 'Commands',
    spec: { usage: 'choliba completion bash' },
  },
];

/** `choliba --help`. */
/** `choliba --help`. */
export const CHOLIBA_HELP: CommandSpec = {
  usage: 'choliba COMMAND [ARGS]',
  description:
    'Testes E2E multiprojeto com Playwright, operados por agentes. Roda na pasta de trabalho: a pasta cujo ' +
    'package.json depende de choliba, com o .env, os agentes (agents/), as skills (.agents/skills/) e os MCPs ' +
    '(.agents/mcps/).',
  commands: () => COMMANDS,
  footer: "Run 'choliba COMMAND --help' for more information on a command.",
};

/**
 * The first word after `choliba`, for completion: the subcommands and, as shortcuts, the agents of
 * the workspace. Everything after it is completed by the part of choliba that word selects.
 */
export function firstWordSpec(agentNames: readonly string[]): CommandSpec {
  const agents = agentNames.map((name): CommandEntry => ({
    name,
    description: '',
    group: 'Agents',
    spec: { usage: `choliba ${name}` },
  }));
  return { usage: CHOLIBA_HELP.usage, commands: () => [...COMMANDS, ...agents] };
}
