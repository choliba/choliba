import { configCatalog, type ConfigCatalog, type ConfigGroup, type ConfigSource } from '@choliba/config';
import { Container, ExpectedError, token, type Platform } from '@choliba/kernel';

import { messageOf } from '../cli';
import { unknownWordMessage, type CommandEntry, type CommandSpec } from '../help';
import type { PanelCommand, ShellCommand, ShellModule, ShellRoot, ShellVerb } from './interfaces/shell.interface';
import { programOf, rootAction, rootOf, unknownCommand } from './root-run';
import { ShellIo } from './shell-io';

/** The process and the runtime, as `main.ts` reads them: what every package's services start from. */
export const PLATFORM = token<Platform>('Platform');
/** Every configuration group contributed by the shell's modules. */
export const CONFIG_CATALOG = token<ConfigCatalog>('ConfigCatalog');
/** Every panel command contributed by the shell's modules, in their order. */
export const PANEL_COMMANDS = token<readonly PanelCommand[]>('PanelCommands');
/** What each module shows in a new panel session, in the modules' order. */
export const PANEL_STARTS = token<readonly NonNullable<ShellModule['panelStart']>[]>('PanelStarts');

/** An app's commands: which first words it runs, their help entries, and running one. */
export interface Shell {
  readonly container: Container;
  /** Whether `word`, the first word of the command line, is one of its commands or verbs. */
  has(word: string | undefined): boolean;
  /** Its commands' entries in the root help, in the order of the modules and of their commands, then its verbs. */
  entries(): readonly CommandEntry[];
  /** Runs the command the platform's command line names and resolves to its exit code. */
  run(): Promise<number>;
}

type Action = (container: Container, io: ShellIo) => Promise<void>;

const HELP_WORDS: readonly string[] = ['help', '--help', '-h'];
const ISSUE_URL = 'https://github.com/choliba/choliba/issues';

function unexpectedErrorMessage(error: unknown, debug: boolean): string {
  const message = `erro inesperado: ${messageOf(error)}`;
  const report = `isso parece ser um bug; reporte em ${ISSUE_URL}`;
  if (!debug || !(error instanceof Error) || error.stack === undefined) return `${message}\n${report}`;
  return `${message}\n${error.stack}\n${report}`;
}

/** `read()`, or `fallback` when it throws (a workspace that cannot be read leaves the help and completion quiet). */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Puts `command` under `word` in `byWord`; two commands claiming one word is a bug in the app's module list. */
function claim(
  byWord: Map<string, ShellCommand>,
  owner: Map<string, string>,
  word: string,
  where: string,
  command: ShellCommand,
): void {
  const previous = owner.get(word);
  if (previous !== undefined) {
    throw new Error(`o comando ${word} está em ${previous} e em ${where}.`);
  }
  owner.set(word, where);
  byWord.set(word, command);
}

/** Each first word to the command it runs: the commands without a verb. */
function commandsByWord(modules: readonly ShellModule[]): ReadonlyMap<string, ShellCommand> {
  const byWord = new Map<string, ShellCommand>();
  const owner = new Map<string, string>();
  for (const module of modules) {
    for (const command of module.commands.filter(({ verb }) => verb === undefined)) {
      for (const word of [command.name, ...(command.aliases ?? [])]) {
        claim(byWord, owner, word, module.name, command);
      }
    }
  }
  return byWord;
}

/** A verb of the root and its types (`run` → `agent`, `tests`), by name, in module order. */
interface VerbTypes {
  readonly verb: ShellVerb;
  readonly types: ReadonlyMap<string, ShellCommand>;
}

/**
 * Each verb of the root with its types. A command under a verb the root does not declare, a verb that is also a
 * command, or two types with one name under a verb are bugs in the app's list.
 */
function typesOfVerbs(
  modules: readonly ShellModule[],
  verbs: readonly ShellVerb[],
  byWord: ReadonlyMap<string, ShellCommand>,
): readonly VerbTypes[] {
  const declared = new Set(verbs.map(({ name }) => name));
  for (const module of modules) {
    for (const { verb, name } of module.commands) {
      if (verb !== undefined && !declared.has(verb)) {
        throw new Error(`o comando ${verb} ${name} de ${module.name} usa um verbo que a raiz não tem.`);
      }
    }
  }
  return verbs.map((verb) => {
    if (byWord.has(verb.name)) throw new Error(`o verbo ${verb.name} também é um comando.`);
    const types = new Map<string, ShellCommand>();
    const owner = new Map<string, string>();
    for (const module of modules) {
      for (const command of module.commands.filter((each) => each.verb === verb.name)) {
        claim(types, owner, command.name, module.name, command);
      }
    }
    return { verb, types };
  });
}

/** Registers the modules' panel commands; two with one name are a bug, named with both modules. */
function providePanelCommands(container: Container, modules: readonly ShellModule[]): void {
  const owners = new Map<string, string>();
  for (const module of modules) {
    for (const command of module.panel ?? []) {
      const owner = owners.get(command.name);
      if (owner !== undefined) {
        throw new Error(`o comando de painel /${command.name} vem de ${owner} e de ${module.name}.`);
      }
      owners.set(command.name, module.name);
    }
  }
  const commands = modules.flatMap((module) => module.panel ?? []);
  container.provide(PANEL_COMMANDS, () => commands);
  const starts = modules.flatMap((module) => (module.panelStart === undefined ? [] : [module.panelStart]));
  container.provide(PANEL_STARTS, () => starts);
}

/** Registers the modules' configuration catalog and each group's lazy value. */
function provideConfig(container: Container, modules: readonly ShellModule[], sources: readonly ConfigSource[]): void {
  const contributed: readonly ConfigGroup[] = modules.flatMap((module) => module.config ?? []);
  const groups = contributed.filter((group, index) => contributed.indexOf(group) === index);
  const catalog = configCatalog(groups);
  container.provide(CONFIG_CATALOG, () => catalog);
  for (const group of groups) {
    container.provide(group.token, () => group.read(sources));
  }
}

/** The shell of an app on `platform`: each module registers its services, config and commands. */
export function createShell(
  platform: Platform,
  modules: readonly ShellModule[],
  configSources: readonly ConfigSource[] = [],
): Shell {
  const container = new Container();
  container.provide(PLATFORM, () => platform);
  provideConfig(container, modules, configSources);
  providePanelCommands(container, modules);
  for (const module of modules) {
    module.provide?.(container);
  }
  const root = rootOf(modules);
  const verbs = root?.verbs ?? [];
  const byWord = commandsByWord(modules);
  const verbTypes = typesOfVerbs(modules, verbs, byWord);
  const commands = modules.flatMap((module) => module.commands.filter(({ verb }) => verb === undefined));

  function helpOf(command: ShellCommand): readonly CommandEntry[] {
    return safely(() => command.help?.(container) ?? [], []);
  }

  /** `choliba run --help`: the verb and its types, each with the help its package gives. */
  function verbSpec(program: string, { verb, types: byName }: VerbTypes): CommandSpec {
    const types = [...byName.values()];
    return {
      usage: `${program} ${verb.name} TYPE [ARGS]`,
      description: verb.description,
      ...(verb.examples === undefined ? {} : { examples: verb.examples }),
      commands: () => types.flatMap(helpOf),
      flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
      footer: `Run '${program} ${verb.name} TYPE --help' for more information on a type.`,
    };
  }

  function verbEntries(): readonly CommandEntry[] {
    if (root === undefined) return [];
    const program = programOf(root);
    return verbTypes.map((each) => ({
      name: each.verb.name,
      description: each.verb.description,
      group: 'Commands',
      spec: verbSpec(program, each),
    }));
  }

  function entries(): readonly CommandEntry[] {
    return [...commands.flatMap(helpOf), ...verbEntries()];
  }

  /** Runs `action` on `argv`: what it throws is its message on stderr and exit code 1. */
  async function execute(action: Action, argv: readonly string[]): Promise<number> {
    const io = new ShellIo({ argv, stdout: platform.stdout, stderr: platform.stderr });
    try {
      await action(container, io);
    } catch (error) {
      io.fail(
        error instanceof ExpectedError
          ? messageOf(error)
          : unexpectedErrorMessage(error, platform.env['CHOL_DEBUG'] === '1'),
      );
    }
    return io.exitCode();
  }

  function runIo(action: (io: ShellIo) => void): Promise<number> {
    return execute((_container, io) => {
      action(io);
      return Promise.resolve();
    }, platform.argv);
  }

  /** `choliba <verb> <type> …`: the type's command, its help, or what is missing or wrong. */
  function runVerb(shellRoot: ShellRoot, verbType: VerbTypes): Promise<number> {
    const { verb, types } = verbType;
    const program = `${programOf(shellRoot)} ${verb.name}`;
    const [, type] = platform.argv;
    const command = type === undefined ? undefined : types.get(type);
    if (command !== undefined) return execute(command.run, platform.argv);
    const names = [...types.keys()];
    return runIo((io) => {
      if (type === undefined) io.usageError(`falta o tipo: ${names.join(' ou ')}.`, program);
      else if (HELP_WORDS.includes(type)) io.printHelp(verbSpec(programOf(shellRoot), verbType));
      else io.usageError(unknownWordMessage('tipo desconhecido', type, names), program);
    });
  }

  return {
    container,
    has: (word) => word !== undefined && (byWord.has(word) || verbTypes.some(({ verb }) => verb.name === word)),
    entries,
    run() {
      const [first] = platform.argv;
      if (root !== undefined) {
        const action = rootAction(root, platform.argv, entries);
        if (action !== undefined) return runIo(action);
      }
      const command = first === undefined ? undefined : byWord.get(first);
      if (command !== undefined) return execute(command.run, platform.argv);
      const verbType = verbTypes.find(({ verb }) => verb.name === first);
      if (root !== undefined && verbType !== undefined) return runVerb(root, verbType);
      if (root !== undefined && first !== undefined) return runIo(unknownCommand(root, first, entries()));
      return Promise.reject(
        new Error(`a linha de comando não começa com um comando da tabela: ${platform.argv.join(' ')}`),
      );
    },
  };
}
