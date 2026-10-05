import { EXECUTION_MODES, type ExecutionMode } from '../interfaces/command.interface';
import { SINCE_PENDING } from '../../steps/constants';
import type { ProviderRegistry } from '../../providers/provider-registry';

/** Program name in help and error messages. */
export const CLI_PROGRAM_NAME = 'choliba agents';

/** Appended to every argument error; the full reference is `agents --help`, built from `runFlagDefinitions`. */
export const USAGE = `Run '${CLI_PROGRAM_NAME} --help' for usage.`;

export { EXECUTION_MODES };

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

/** Flags that only matter for agents with a `git_diff` in `before_execute` (they pick the diff base). */
export const PREPARE_FLAGS: readonly string[] = ['--since', `--since-${SINCE_PENDING}`];

/** Flags that only matter for agents that act on a project (`AgentDefinition.projectRequired`). */
export const PROJECT_FLAGS: readonly string[] = ['--project'];

/** Flags that only matter for agents with `ticket_types`; each type is also its own `--type-<type>` shortcut. */
export const TICKET_FLAGS: readonly string[] = ['--type', '--ticket'];

/** The prefix of the `--type-<type>` shortcuts, which the parser accepts for any type (the agent checks it). */
export const TYPE_SHORTCUT_PREFIX = '--type-';

/**
 * Every flag accepted after the command name. `--help` and shell completion are generated from
 * this list, and a spec checks that the parser below accepts each entry, so the three stay in step.
 */
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
    { name: '--agents-dir', valueName: 'dir', description: 'Pasta dos agentes (padrão: .choliba/agents/)' },
    {
      name: '--add-dir',
      valueName: 'dir',
      repeatable: true,
      description: 'Pasta extra liberada para o provider (pode repetir)',
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

export class AgentsArgsError extends Error {}

/**
 * A flag the command does not take, in the layout of `docker --goiaba`: the flag, the command's usage
 * and where its help is. Used for a flag no agent knows (here) and for one this agent does not take
 * (`cli/run.ts`, once the agent is loaded).
 */
export function unknownFlagMessage(flag: string, command: string): string {
  return [
    `unknown flag: ${flag}`,
    '',
    `Usage:  ${CLI_PROGRAM_NAME} ${command} [OPTIONS] [TASK...]`,
    '',
    `Run '${CLI_PROGRAM_NAME} ${command} --help' for more information`,
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

export type ParsedAgentsArgs =
  | { readonly kind: 'help' }
  | { readonly kind: 'list'; readonly agentsDir: string | undefined }
  | ({ readonly kind: 'run' } & ParsedRunArgs);

/**
 * Consumes and returns the next token, or throws naming `flag`. A plain `queue.shift()` inline
 * would type as `string | undefined` under `noUncheckedIndexedAccess`, forcing a defensive
 * `!== undefined` check after every call site that no input could ever actually take — this is
 * the one place that check lives, and it's exercised by every "missing value for --x" test.
 */
function nextValue(queue: string[], flag: string): string {
  const value = queue.shift();
  if (value === undefined) {
    throw new AgentsArgsError(`Missing value for ${flag}. ${USAGE}`);
  }
  return value;
}

function parseListArgs(rest: readonly string[]): ParsedAgentsArgs {
  const queue = [...rest];
  let agentsDir: string | undefined;
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    if (arg === '--agents-dir') {
      agentsDir = nextValue(queue, '--agents-dir');
      continue;
    }
    throw new AgentsArgsError(`Unknown argument "${arg}" for "list". ${USAGE}`);
  }
  return { kind: 'list', agentsDir };
}

/**
 * Only the flags themselves are validated here — never against a resolved command or agent
 * (this module knows nothing about either). Cross-cutting checks like "--plan-from only makes
 * sense with execute mode" depend on the command's `defaultMode` and belong in `cli/run.ts`,
 * once the command is resolved. The exceptions are two different modes (`--mode x` or `--mode-x`)
 * or two different `--since` bases: those are raw flags, so the conflict is visible without
 * resolving anything.
 */
export function parseAgentsArgs(argv: readonly string[], providers: ProviderRegistry): ParsedAgentsArgs {
  const [first, ...rest] = argv;
  if (first === undefined || first === 'help' || first === '--help' || first === '-h') {
    return { kind: 'help' };
  }
  if (first === 'list') {
    return parseListArgs(rest);
  }

  // `--<command>` is accepted as an alternative to the bare positional form, so
  // `agents --<command>` and `agents <command>` resolve to the same command.
  const command = first.startsWith('--') ? first.slice(2) : first;
  if (command === '') {
    throw new AgentsArgsError(`Missing command. ${USAGE}`);
  }
  const taskWords: string[] = [];
  let mode: ExecutionMode | undefined;
  let planFrom: string | undefined;
  let project: string | undefined;
  let ticketType: string | undefined;
  let ticket: string | undefined;
  let provider: string | undefined;
  let model: string | undefined;
  let agentsDir: string | undefined;
  const addDirs: string[] = [];
  let dryRun = false;
  let showPrompt = false;
  let since: string | undefined;
  let help = false;

  // A mode or a diff base may come from the long flag or its shortcut; saying two different
  // things in the same command line is an error rather than a silent "last one wins".
  const setMode = (value: ExecutionMode): void => {
    if (mode !== undefined && mode !== value) {
      throw new AgentsArgsError(`Conflicting modes: ${mode} and ${value}. ${USAGE}`);
    }
    mode = value;
  };
  const setTicketType = (value: string): void => {
    if (value === '') {
      throw new AgentsArgsError(`Missing ticket type in ${TYPE_SHORTCUT_PREFIX}<type>. ${USAGE}`);
    }
    if (ticketType !== undefined && ticketType !== value) {
      throw new AgentsArgsError(`Conflicting ticket types: ${ticketType} and ${value}. ${USAGE}`);
    }
    ticketType = value;
  };
  const setSince = (value: string): void => {
    if (since !== undefined && since !== value) {
      throw new AgentsArgsError(`Conflicting --since values: ${since} and ${value}. ${USAGE}`);
    }
    since = value;
  };

  const flags: string[] = [];
  const queue = [...rest];
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    if (arg.startsWith('-')) {
      flags.push(arg);
    }
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--mode') {
      const value = nextValue(queue, '--mode');
      const known = EXECUTION_MODES.find((candidate) => candidate === value);
      if (known === undefined) {
        throw new AgentsArgsError(`--mode must be execute, plan or ask, got "${value}". ${USAGE}`);
      }
      setMode(known);
      continue;
    }
    const shortcutMode = EXECUTION_MODES.find((candidate) => arg === `--mode-${candidate}`);
    if (shortcutMode !== undefined) {
      setMode(shortcutMode);
      continue;
    }
    if (arg === '--plan-from') {
      planFrom = nextValue(queue, '--plan-from');
      continue;
    }
    if (arg === '--project') {
      project = nextValue(queue, '--project');
      continue;
    }
    if (arg === '--type') {
      setTicketType(nextValue(queue, '--type'));
      continue;
    }
    if (arg.startsWith(TYPE_SHORTCUT_PREFIX)) {
      setTicketType(arg.slice(TYPE_SHORTCUT_PREFIX.length));
      continue;
    }
    if (arg === '--ticket') {
      ticket = nextValue(queue, '--ticket');
      continue;
    }
    if (arg === '--provider') {
      provider = nextValue(queue, '--provider');
      continue;
    }
    if (arg.startsWith('--') && providers.choices().includes(arg.slice(2))) {
      // Shorthand for `--provider <name>`, same as `--<command>` is shorthand for the positional
      // command — no `--provider` needed when the name itself already says which one.
      provider = arg.slice(2);
      continue;
    }
    if (arg === '--model') {
      model = nextValue(queue, '--model');
      continue;
    }
    if (arg === '--agents-dir') {
      agentsDir = nextValue(queue, '--agents-dir');
      continue;
    }
    if (arg === '--add-dir') {
      addDirs.push(nextValue(queue, '--add-dir'));
      continue;
    }
    if (arg === '--since') {
      setSince(nextValue(queue, '--since'));
      continue;
    }
    if (arg === `--since-${SINCE_PENDING}`) {
      setSince(SINCE_PENDING);
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--show-prompt') {
      showPrompt = true;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new AgentsArgsError(unknownFlagMessage(arg, command));
    }
    taskWords.push(arg);
  }

  if (ticketType !== undefined && ticket !== undefined) {
    throw new AgentsArgsError(`--type creates a new ticket and --ticket opens an existing one: use only one. ${USAGE}`);
  }
  if (showPrompt && !dryRun) {
    throw new AgentsArgsError(`--show-prompt only works with --dry-run. ${USAGE}`);
  }

  return {
    kind: 'run',
    command,
    task: taskWords.join(' '),
    mode,
    planFrom,
    project,
    ticketType,
    ticket,
    provider,
    model,
    agentsDir,
    addDirs,
    dryRun,
    showPrompt,
    since,
    help,
    flags,
  };
}
