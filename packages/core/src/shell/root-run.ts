import { complete, describe, formatSuggestions, type CommandEntry, type CommandSpec } from '../help';
import type { ShellModule, ShellRoot } from './interfaces/shell.interface';
import type { ShellIo } from './shell-io';

const HELP_WORDS: readonly string[] = ['help', '--help', '-h'];
const VERSION_WORDS: readonly string[] = ['version', '--version'];

/** The one module's root; two modules each defining the root is a bug in the app's list. */
export function rootOf(modules: readonly ShellModule[]): ShellRoot | undefined {
  const owners = modules.filter((module) => module.root !== undefined);
  if (owners.length > 1) {
    throw new Error(`mais de um módulo define a raiz: ${owners.map(({ name }) => name).join(', ')}.`);
  }
  return owners[0]?.root;
}

function programOf(root: ShellRoot): string {
  return root.spec.usage.split(' ', 1).join('');
}

function rank(list: readonly string[], value: string): number {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
}

interface RootCommandSpec extends CommandSpec {
  readonly commands: () => readonly CommandEntry[];
}

/** The whole CLI as one spec: `root` with the commands, sorted by section, then by name. */
export function specOf(root: ShellRoot, entries: readonly CommandEntry[]): RootCommandSpec {
  const groups = root.groups ?? [];
  const order = root.order ?? [];
  return {
    ...root.spec,
    commands: () =>
      [...entries].toSorted(
        (left, right) =>
          rank(groups, left.group) - rank(groups, right.group) || rank(order, left.name) - rank(order, right.name),
      ),
  };
}

/** What the root does for this line, or nothing when a command of the table should run it. */
export function rootAction(
  root: ShellRoot,
  argv: readonly string[],
  entries: () => readonly CommandEntry[],
): ((io: ShellIo) => void) | undefined {
  const [first] = argv;
  if (first === undefined || HELP_WORDS.includes(first)) {
    return (io) => {
      io.printHelp(specOf(root, entries()));
    };
  }
  if (VERSION_WORDS.includes(first)) {
    return (io) => {
      io.write(`${root.version()}\n`);
    };
  }
  if (first === '__complete') {
    return (io) => {
      printCompletions(root, entries, io);
    };
  }
  if (first === '__describe') {
    return (io) => {
      printDescription(root, entries, io);
    };
  }
  if (first === '__entries') {
    return (io) => {
      printEntries(root, entries, io);
    };
  }
  return undefined;
}

function printCompletions(root: ShellRoot, entries: () => readonly CommandEntry[], io: ShellIo): void {
  const words = io.args('__complete');
  const delegated = root.delegateComplete?.(words);
  if (delegated !== undefined) {
    io.write(delegated);
    return;
  }
  const output = formatSuggestions(complete(specOf(root, entries()), words));
  if (output !== '') io.write(`${output}\n`);
}

function printDescription(root: ShellRoot, entries: () => readonly CommandEntry[], io: ShellIo): void {
  const [line] = describe(specOf(root, entries()), io.args('__describe')).split('\n');
  io.write(`${String(line)}\n`);
}

function printEntries(root: ShellRoot, entries: () => readonly CommandEntry[], io: ShellIo): void {
  const listed = specOf(root, entries())
    .commands()
    .filter((entry) => entry.listed !== false)
    .map(({ name, description, group }) => ({ name, description, group }));
  io.write(`${JSON.stringify(listed)}\n`);
}

/** A first word that is no command and that no fallback takes. */
export function unknownCommand(root: ShellRoot, word: string): (io: ShellIo) => void {
  return (io) => {
    io.usageError(`comando desconhecido: ${word}.`, programOf(root));
  };
}
