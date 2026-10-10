import { messageOf, type RootFallback } from '../cli';
import type { CommandEntry } from '../help';
import type { Platform } from '../platform';
import { Container, token } from './container';
import type { ShellCommand, ShellModule } from './interfaces/shell.interface';
import { rootAction, rootOf, unknownCommand } from './root-run';
import { ShellIo } from './shell-io';

/** The process and the runtime, as `main.ts` reads them: what every package's services start from. */
export const PLATFORM = token<Platform>('Platform');

/** An app's commands: which first words it runs, their help entries, and running one. */
export interface Shell {
  readonly container: Container;
  /** Whether `word`, the first word of the command line, is one of its commands. */
  has(word: string | undefined): boolean;
  /** Its commands' entries in the root help, in the order of the modules and of their commands. */
  entries(): readonly CommandEntry[];
  /** Runs the command the platform's command line names and resolves to its exit code. */
  run(): Promise<number>;
  /** What runs a first word that is no command, when a module has it. */
  readonly fallback: RootFallback | undefined;
}

type Action = (container: Container, io: ShellIo) => Promise<void>;

/** The one module's fallback; two modules each claiming the words that are no command is a bug in the app's list. */
function fallbackOf(modules: readonly ShellModule[]): Action | undefined {
  const owners = modules.filter((module) => module.fallback !== undefined);
  if (owners.length > 1) {
    throw new Error(
      `mais de um módulo trata a palavra que não é comando: ${owners.map(({ name }) => name).join(', ')}.`,
    );
  }
  return owners[0]?.fallback;
}

/** `read()`, or `fallback` when it throws (a workspace that cannot be read leaves the help and completion quiet). */
function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

/** Each first word to the command it runs. Two commands claiming one word is a bug in the app's module list. */
function commandsByWord(modules: readonly ShellModule[]): ReadonlyMap<string, ShellCommand> {
  const byWord = new Map<string, ShellCommand>();
  const owner = new Map<string, string>();
  for (const module of modules) {
    for (const command of module.commands) {
      for (const word of [command.name, ...(command.aliases ?? [])]) {
        const previous = owner.get(word);
        if (previous !== undefined) {
          throw new Error(`o comando ${word} está em ${previous} e em ${module.name}.`);
        }
        owner.set(word, module.name);
        byWord.set(word, command);
      }
    }
  }
  return byWord;
}

/** The shell of an app on `platform`: each module registers its services, and its commands go in the table. */
export function createShell(platform: Platform, modules: readonly ShellModule[]): Shell {
  const container = new Container();
  container.provide(PLATFORM, () => platform);
  for (const module of modules) {
    module.provide?.(container);
  }
  const byWord = commandsByWord(modules);
  const commands = modules.flatMap((module) => module.commands);
  const fallback = fallbackOf(modules);
  const root = rootOf(modules);

  function entries(): readonly CommandEntry[] {
    return commands.flatMap((command) => safely(() => command.help?.(container) ?? [], []));
  }

  /** Runs `action` on `argv`: what it throws is its message on stderr and exit code 1. */
  async function execute(action: Action, argv: readonly string[]): Promise<number> {
    const io = new ShellIo({ argv, stdout: platform.stdout, stderr: platform.stderr });
    try {
      await action(container, io);
    } catch (error) {
      io.fail(messageOf(error));
    }
    return io.exitCode();
  }

  function runIo(action: (io: ShellIo) => void): Promise<number> {
    return execute((_container, io) => {
      action(io);
      return Promise.resolve();
    }, platform.argv);
  }

  return {
    container,
    has: (word) => word !== undefined && byWord.has(word),
    entries,
    run() {
      const [first] = platform.argv;
      if (root !== undefined) {
        const action = rootAction(root, platform.argv, entries);
        if (action !== undefined) return runIo(action);
      }
      const command = first === undefined ? undefined : byWord.get(first);
      if (command !== undefined) return execute(command.run, platform.argv);
      if (fallback !== undefined) return execute(fallback, platform.argv);
      if (root !== undefined && first !== undefined) return runIo(unknownCommand(root, first));
      return Promise.reject(
        new Error(`a linha de comando não começa com um comando da tabela: ${platform.argv.join(' ')}`),
      );
    },
    fallback: fallback === undefined ? undefined : { runUnknown: (argv) => execute(fallback, argv) },
  };
}
