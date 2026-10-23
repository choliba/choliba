import { EXECUTION_MODES } from '../../common';
import { SINCE_PENDING } from '@choliba/engine';
import type { ProviderRegistry } from '../../common';
import { unknownWordMessage } from '@choliba/shell';

import {
  AgentsArgsError,
  isSandboxChoice,
  LIST_PROGRAM_NAME,
  runFlagDefinitions,
  TYPE_SHORTCUT_PREFIX,
  unknownFlagMessage,
  USAGE,
  type ParsedAgentsArgs,
  type ParsedListArgs,
  type SandboxChoice,
} from './run-flag-definitions';
import type { ExecutionMode } from '../../common';

/**
 * Consumes and returns the next token, or throws naming `flag`. A plain `queue.shift()` inline
 * would type as `string | undefined` under `noUncheckedIndexedAccess`, forcing a defensive
 * `!== undefined` check after every call site that no input could ever actually take — this is
 * the one place that check lives, and it's exercised by every "missing value for --x" test.
 */
function nextValue(queue: string[], flag: string): string {
  const value = queue.shift();
  if (value === undefined) {
    throw new AgentsArgsError(`falta um valor para ${flag}. ${USAGE}`);
  }
  return value;
}

/** The arguments after `choliba list agents`. */
export function parseListArgs(argv: readonly string[]): ParsedListArgs {
  const queue = [...argv];
  let agentsDir: string | undefined;
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    if (arg === '--help' || arg === '-h') return { kind: 'help' };
    if (arg === '--agents-dir') {
      agentsDir = nextValue(queue, '--agents-dir');
      continue;
    }
    throw new AgentsArgsError(
      `${unknownWordMessage('opção desconhecida', arg, ['--agents-dir', '--help', '-h'])}\n` +
        `Run '${LIST_PROGRAM_NAME} --help' for usage.`,
    );
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
  // `--<command>` is accepted as an alternative to the bare positional form, so
  // `agents --<command>` and `agents <command>` resolve to the same command.
  const command = first.startsWith('--') ? first.slice(2) : first;
  if (command === '') {
    throw new AgentsArgsError(`falta o agente. ${USAGE}`);
  }
  const taskWords: string[] = [];
  let mode: ExecutionMode | undefined;
  let planFrom: string | undefined;
  let project: string | undefined;
  let ticketType: string | undefined;
  let ticket: string | undefined;
  let provider: string | undefined;
  let model: string | undefined;
  let sandbox: SandboxChoice | undefined;
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
      throw new AgentsArgsError(`modos conflitantes: ${mode} e ${value}. ${USAGE}`);
    }
    mode = value;
  };
  const setTicketType = (value: string): void => {
    if (value === '') {
      throw new AgentsArgsError(`falta o tipo de ticket em ${TYPE_SHORTCUT_PREFIX}<tipo>. ${USAGE}`);
    }
    if (ticketType !== undefined && ticketType !== value) {
      throw new AgentsArgsError(`tipos de ticket conflitantes: ${ticketType} e ${value}. ${USAGE}`);
    }
    ticketType = value;
  };
  const setSince = (value: string): void => {
    if (since !== undefined && since !== value) {
      throw new AgentsArgsError(`valores de --since conflitantes: ${since} e ${value}. ${USAGE}`);
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
        throw new AgentsArgsError(`--mode precisa ser execute, plan ou ask, não "${value}". ${USAGE}`);
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
    if (arg === '--sandbox') {
      const value = nextValue(queue, '--sandbox');
      if (!isSandboxChoice(value)) {
        throw new AgentsArgsError(`--sandbox precisa ser local ou docker, não "${value}". ${USAGE}`);
      }
      sandbox = value;
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
      const candidates = runFlagDefinitions(providers).flatMap(({ name, aliases = [] }) => [name, ...aliases]);
      throw new AgentsArgsError(unknownFlagMessage(arg, command, candidates));
    }
    taskWords.push(arg);
  }

  if (ticketType !== undefined && ticket !== undefined) {
    throw new AgentsArgsError(`--type cria um ticket novo e --ticket abre um existente: use apenas um. ${USAGE}`);
  }
  if (showPrompt && !dryRun) {
    throw new AgentsArgsError(`--show-prompt só funciona com --dry-run. ${USAGE}`);
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
    sandbox,
    agentsDir,
    addDirs,
    dryRun,
    showPrompt,
    since,
    help,
    flags,
  };
}
