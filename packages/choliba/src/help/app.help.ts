import type { CommandEntry, CommandSpec, Suggestions } from '@choliba/core/cli';
import { testsCliSpec } from '@choliba/runner';

const FILES = (): Suggestions => ({ kind: 'files' });

/** What `choliba --help` lists, and what its first word completes to (with the agents). */
export const COMMANDS: readonly CommandEntry[] = [
  {
    name: 'agents',
    description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/); `choliba <agente>` é atalho',
    group: 'Commands',
    spec: { usage: 'choliba agents COMMAND [OPTIONS] [TASK...]' },
  },
  {
    name: 'projects',
    description: 'Cria e lista projetos e tickets em CHOL_PROJECTS_DIR',
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

/**
 * `choliba <command> --help` of a command choliba runs itself (`install`, `check`, `setup`, `completion`): its
 * spec, described by the line `choliba --help` lists it with.
 */
export function commandHelp(name: string): CommandSpec {
  const entry = COMMANDS.find((command) => command.name === name);
  if (entry === undefined) return CHOLIBA_HELP;
  return { ...entry.spec, description: entry.spec.description ?? entry.description };
}

/** The flag every command takes, removed from the command line before any of them sees it. */
const GLOBAL_FLAGS = [
  { name: '--no-color', description: 'Saída sem cores (vale para todo comando; NO_COLOR=1 também)' },
  { name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true },
];

/** `choliba --help`. */
export const CHOLIBA_HELP: CommandSpec = {
  usage: 'choliba COMMAND [ARGS]',
  description:
    'Testes E2E multiprojeto com Playwright, operados por agentes. Roda na pasta de trabalho: a pasta cujo ' +
    'package.json depende de choliba, com o .env, os agentes (.choliba/agents/), as skills ' +
    '(.choliba/skills/) e os MCPs (.choliba/mcps/).',
  commands: () => COMMANDS,
  flags: GLOBAL_FLAGS,
  footer: "Run 'choliba COMMAND --help' for more information on a command.",
};
