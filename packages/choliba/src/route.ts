import type { CommandEntry, CommandSpec, Suggestions } from '@choliba/core/cli';
import { testsCliSpec } from '@choliba/runner';

/** What `choliba` runs itself; any other first word is an agent of the workspace. */
export const SUBCOMMANDS = [
  'agents',
  'projects',
  'tests',
  'playwright-cli',
  'playwright-trace',
  'install',
  'check',
  'lint',
  'format',
  'setup',
  'completion',
] as const;

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

const FILES = (): Suggestions => ({ kind: 'files' });

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
    // Its projects and tickets are completed by the runner itself (`choliba tests __complete`).
    spec: testsCliSpec(
      () => [],
      () => [],
    ),
  },
  {
    name: 'playwright-cli',
    description: 'O navegador que os agentes usam (playwright cli)',
    group: 'Commands',
    spec: { usage: 'choliba playwright-cli COMMAND [ARGS]', positionals: FILES },
  },
  {
    name: 'playwright-trace',
    description: 'Lê um trace.zip de teste que falhou (playwright trace), na versão do runner',
    group: 'Commands',
    spec: { usage: 'choliba playwright-trace COMMAND [ARGS]', positionals: FILES },
  },
  {
    name: 'install',
    description:
      'Instala um agente (com suas skills e MCPs), uma skill ou um MCP de uma pasta, repositório git ou pacote npm',
    group: 'Commands',
    spec: {
      usage: 'choliba install <origem> [OPTIONS]',
      positionals: FILES,
      flags: [
        {
          name: '--path',
          value: { name: 'caminho', suggest: () => ({ kind: 'files' }) },
          description: 'Item dentro da origem (ex.: .choliba/agents/test-writer)',
        },
        { name: '--dry-run', description: 'Mostra o que instalaria, sem gravar' },
      ],
    },
  },
  {
    name: 'check',
    description: 'Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos',
    group: 'Commands',
    spec: { usage: 'choliba check' },
  },
  {
    name: 'lint',
    description: 'ESLint na pasta de trabalho, com a configuração que vem no choliba',
    group: 'Commands',
    spec: { usage: 'choliba lint [ESLINT_ARGS]', positionals: FILES },
  },
  {
    name: 'format',
    description: 'Prettier na pasta de trabalho: confere, ou corrige com --write',
    group: 'Commands',
    spec: {
      usage: 'choliba format [--write] [PATHS...]',
      flags: [{ name: '--write', description: 'Corrige em vez de só conferir' }],
      positionals: FILES,
    },
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
    spec: {
      usage: 'choliba completion bash',
      positionals: (previous) => ({ kind: 'values', values: previous.length === 0 ? ['bash'] : [] }),
    },
  },
];

/** The subcommands choliba runs itself; the others take `--help` to the CLI or tool they hand off to. */
const OWN_HELP: readonly Subcommand[] = ['install', 'check', 'setup', 'completion'];

/**
 * `choliba <subcommand> --help`, for the subcommands choliba runs itself: their spec, described by the
 * same line `choliba --help` lists them with. Nothing for anything else.
 */
export function subcommandHelp(target: Route): CommandSpec | undefined {
  if (!target.argv.some((arg) => arg === '--help' || arg === '-h')) return undefined;
  const entry = COMMANDS.find(
    (command) => command.name === target.kind && OWN_HELP.some((name) => name === command.name),
  );
  if (entry === undefined) return undefined;
  return { ...entry.spec, description: entry.spec.description ?? entry.description };
}

/** `choliba --help`. */
export const CHOLIBA_HELP: CommandSpec = {
  usage: 'choliba COMMAND [ARGS]',
  description:
    'Testes E2E multiprojeto com Playwright, operados por agentes. Roda na pasta de trabalho: a pasta cujo ' +
    'package.json depende de choliba, com o .env, os agentes (.choliba/agents/), as skills ' +
    '(.choliba/skills/) e os MCPs (.choliba/mcps/).',
  commands: () => COMMANDS,
  footer: "Run 'choliba COMMAND --help' for more information on a command.",
};

/**
 * What completion walks: the subcommands and, as shortcuts, the agents of the workspace. `agents`,
 * `projects` and `tests` complete the rest of the line themselves.
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
