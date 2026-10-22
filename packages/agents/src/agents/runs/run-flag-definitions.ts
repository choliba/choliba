import { EXECUTION_MODES, type ExecutionMode } from '../../common';
import { SINCE_PENDING } from '@choliba/engine';
import type { ProviderRegistry } from '../../common';
import { ExpectedError, unknownWordMessage } from '@choliba/core';

/** Program name in help and error messages. */
export const CLI_PROGRAM_NAME = 'choliba run agent';

/** The command that lists the agents. */
export const LIST_PROGRAM_NAME = 'choliba list agents';

/** Appended to every argument error; the full reference is `agents --help`, built from `runFlagDefinitions`. */
export const USAGE = `Run '${CLI_PROGRAM_NAME} --help' for usage.`;

export interface RunFlagDefinition {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly description: string;
  /** Shown in `--help` after the flag; absent for a boolean flag. */
  readonly valueName?: string;
  readonly repeatable?: boolean;
  readonly terminal?: boolean;
  /** The values the flag takes, each with what it means; `--help` lists them under the description. */
  readonly choices?: readonly { readonly name: string; readonly description: string }[];
}

/** `--mode` in words; `defaultMode` is the agent's `modes.default` when known. The values are `MODE_CHOICES`. */
export function modeDescription(defaultMode = 'modes.default do agente'): string {
  return `Modo de execução (padrão: ${defaultMode}):`;
}

/** What each `--mode` does, listed under `--mode` in `--help`. */
export const MODE_CHOICES: Readonly<Record<ExecutionMode, string>> = {
  execute: 'Faz a tarefa, com as permissões que o agente declara.',
  plan: 'Só planeja, sem gravar nada, e salva o plano em plans/ para rodar depois com --plan-from.',
  ask: 'Só responde, sem gravar nada.',
};

/** `--since` values in words; `defaultBase` is the base of the agent's `git_diff` when known. */
export function sinceDescription(defaultBase = 'base do git_diff do agente'): string {
  return `Base do diff: ${SINCE_PENDING} (desde a última execução registrada), HEAD~N, branch, tag ou SHA (padrão: ${defaultBase})`;
}

/** Where the provider runs, as `--sandbox` and `/sandbox` say it: the values `CHOL_SANDBOX` takes. */
export const SANDBOX_CHOICES = {
  local: 'Nesta máquina, isolado com bwrap',
  docker: 'Num container do Docker',
} as const;

/** A value of `--sandbox`. */
export type SandboxChoice = keyof typeof SANDBOX_CHOICES;

/** Whether `value` is one of `SANDBOX_CHOICES`. */
export const isSandboxChoice = (value: string): value is SandboxChoice => Object.hasOwn(SANDBOX_CHOICES, value);

/** Flags that only matter for agents with a `git_diff` in `before_execute` (they pick the diff base). */
export const PREPARE_FLAGS: readonly string[] = ['--since', `--since-${SINCE_PENDING}`];

/** Flags that only matter for agents that act on a project (`AgentDefinition.projectRequired`). */
export const PROJECT_FLAGS: readonly string[] = ['--project'];

/** Flags that only matter for agents with `ticket_types`; each type is also its own `--type-<type>` shortcut. */
export const TICKET_FLAGS: readonly string[] = ['--type', '--ticket'];

/** The prefix of the `--type-<type>` shortcuts, which the parser accepts for any type (the agent checks it). */
export const TYPE_SHORTCUT_PREFIX = '--type-';

/** Every flag a run takes; the provider ones come from the providers choliba found. */
export function runFlagDefinitions(providers: ProviderRegistry): readonly RunFlagDefinition[] {
  return [
    {
      name: '--mode',
      valueName: 'string',
      description: modeDescription(),
      choices: EXECUTION_MODES.map((mode) => ({ name: mode, description: MODE_CHOICES[mode] })),
    },
    ...EXECUTION_MODES.map((mode) => ({ name: `--mode-${mode}`, description: `Atalho para --mode ${mode}` })),
    {
      name: '--project',
      valueName: 'name',
      description: 'Projeto em CHOL_PROJECTS_DIR sobre o qual o agente age; validado antes de chamar o provider',
    },
    {
      name: '--type',
      valueName: 'type',
      description: 'Tipo do ticket novo, criado pelo CLI a partir do template do tipo:',
    },
    { name: '--ticket', valueName: 'key', description: 'Ticket existente do projeto sobre o qual o agente trabalha' },
    { name: '--plan-from', valueName: 'file', description: 'Executa um plano salvo (arquivo em plans/)' },
    { name: '--since', valueName: 'ref', description: sinceDescription() },
    {
      name: `--since-${SINCE_PENDING}`,
      description: `Atalho para --since ${SINCE_PENDING} (desde a última execução registrada)`,
    },
    {
      name: '--provider',
      valueName: 'string',
      description: 'Provider que roda o agente (padrão: auto):',
      choices: providers.descriptions(),
    },
    ...providers.choices().map((choice) => ({ name: `--${choice}`, description: `Atalho para --provider ${choice}` })),
    { name: '--model', valueName: 'string', description: 'Modelo; precisa estar em models do agente' },
    {
      name: '--sandbox',
      valueName: 'string',
      description: 'Onde o provider roda, só nesta execução (padrão: CHOL_SANDBOX):',
      choices: Object.entries(SANDBOX_CHOICES).map(([name, description]) => ({ name, description })),
    },
    { name: '--agents-dir', valueName: 'dir', description: 'Pasta dos agentes (padrão: .choliba/agents/)' },
    {
      name: '--add-dir',
      valueName: 'dir',
      repeatable: true,
      description: 'Pasta extra que o agente pode ler (pode repetir); o deny do agente continua valendo',
    },
    { name: '--dry-run', description: 'Mostra o que seria executado, na ordem, sem executar nada' },
    {
      name: '--show-prompt',
      description:
        'Com --dry-run: mostra os prompts e a linha de comando completos (e, no cursor, os arquivos de .cursor/)',
    },
    { name: '--help', aliases: ['-h'], description: 'Mostra a ajuda do agente', terminal: true },
  ];
}

export class AgentsArgsError extends ExpectedError {}

/**
 * A flag the command does not take, in the layout of `docker --goiaba`: the flag, the command's usage
 * and where its help is. Used for a flag no agent knows (here) and for one this agent does not take
 * (`cli/run.ts`, once the agent is loaded).
 */
export function unknownFlagMessage(flag: string, command: string, candidates: readonly string[]): string {
  return [
    unknownWordMessage('opção desconhecida', flag, candidates),
    '',
    `Usage:  ${CLI_PROGRAM_NAME} ${command} [OPTIONS] [TASK...]`,
    '',
    `Run '${CLI_PROGRAM_NAME} ${command} --help' for usage.`,
  ].join('\n');
}

export interface ParsedRunArgs {
  readonly command: string;
  /** The task, as the positional words joined by a single space; `''` when none were given. */
  readonly task: string;
  /** `undefined` when `--mode` was not given — the command's own `defaultMode` applies then. */
  readonly mode: ExecutionMode | undefined;
  readonly planFrom: string | undefined;
  /** `--project`; required only by agents that use a project (see `AgentDefinition.projectRequired`), which `cli/run.ts` checks. */
  readonly project: string | undefined;
  /** `--type` or `--type-<type>`: a new ticket of that type; only for agents with `ticket_types`. */
  readonly ticketType: string | undefined;
  /** `--ticket`: an existing ticket; never together with `--type`. */
  readonly ticket: string | undefined;
  readonly provider: string | undefined;
  readonly model: string | undefined;
  /** `--sandbox`: where the provider runs in this run, over `CHOL_SANDBOX`. */
  readonly sandbox: SandboxChoice | undefined;
  readonly agentsDir: string | undefined;
  readonly addDirs: readonly string[];
  readonly dryRun: boolean;
  /** `--show-prompt`: with `--dry-run`, the prompts in full instead of their sizes. */
  readonly showPrompt: boolean;
  /** Git ref for diff base; meaningful only for agents with a `git_diff` in `before_execute`. */
  readonly since: string | undefined;
  /**
   * `--help`/`-h` appearing after the command name, not as the very first token — that case is
   * global help (`{ kind: 'help' }`, no agent involved). Here a command was already named, so
   * this means "show *that* agent's own info," which `cli/run.ts` handles once it has loaded
   * the agent — generic for any agent, nothing agent-specific lives in this parser.
   */
  readonly help: boolean;
  /** Every flag as typed (`--since-pending`, `--type-bug`, `-h`), without values: checked against the agent's own flags. */
  readonly flags: readonly string[];
}

export type ParsedAgentsArgs = { readonly kind: 'help' } | ({ readonly kind: 'run' } & ParsedRunArgs);

/** `choliba list agents [--agents-dir DIR]`, or its `--help`. */
export type ParsedListArgs =
  { readonly kind: 'help' } | { readonly kind: 'list'; readonly agentsDir: string | undefined };
