import type { ConfigGroup } from '@choliba/config';

import type { CommandEntry, CommandExample, RootSpec } from '../../help';
import type { ChatPanel, PanelCard } from '../../terminal';
import type { Container } from '../container';
import type { ShellIo } from '../shell-io';

/**
 * What an app says about its root: the spec without the commands (they are the modules' `help`), the version line,
 * and how `--help` lays the commands out. At most one module of an app has it.
 */
export interface ShellRoot {
  readonly spec: RootSpec;
  /** The line `--version` prints, as `choliba 0.0.1-dev.16+1a2b3c4`. */
  readonly version: () => string;
  /**
   * The verbs of the root (`run`, `new`, `list`): each is a command whose second word is a type that a package
   * registers (`ShellCommand.verb`). A command naming a verb missing here is a bug in the app's module list.
   */
  readonly verbs?: readonly ShellVerb[];
  /** The order of the root's sections. Sections it does not name come last. */
  readonly groups?: readonly string[];
  /** The order of the commands inside a section, by name. Names it does not list come after, as they were registered. */
  readonly order?: readonly string[];
  /**
   * Called before the local `__complete`. A string is printed as the answer; `undefined` completes from this CLI.
   */
  readonly delegateComplete?: (words: readonly string[]) => string | undefined;
}

/** A verb of the root, what it says in `--help` and its examples. */
export interface ShellVerb {
  readonly name: string;
  readonly description: string;
  readonly examples?: readonly CommandExample[];
}

/** A command of the shell: the word that runs it, its help entries, and what it does. */
export interface ShellCommand {
  /**
   * The verb it is reached under (`run` of `choliba run agent …`), one of the root's `verbs`; `name` is then the second
   * word. Without it, `name` is the first word.
   */
  readonly verb?: string;
  /** The first word on the command line (`terminal` of `choliba terminal run …`), or the type after `verb`. */
  readonly name: string;
  /** Other first words that run it. */
  readonly aliases?: readonly string[];
  /**
   * Its entries in the app's root help and completion, asked for every time (they may read the workspace). Under a
   * verb, its entry in the verb's help.
   */
  readonly help?: (container: Container) => readonly CommandEntry[];
  /** Runs it: reads its arguments and writes through `io`, and gets what it needs from `container`. */
  readonly run: (container: Container, io: ShellIo) => Promise<void>;
}

/**
 * What a package adds to the shell: the factories of its services and its commands. Each package exports one, and the
 * app lists them in a fixed order, so adding a command to a package never touches the app.
 */
export interface ShellModule {
  /** The package it comes from, for messages. */
  readonly name: string;
  /** Registers the package's services. Nothing is built here: the container builds a service when asked for it. */
  readonly provide?: (container: Container) => void;
  /** Configuration groups this package contributes; their values are built only when their token is requested. */
  readonly config?: readonly ConfigGroup[];
  readonly commands: readonly ShellCommand[];
  /** Commands typed in `choliba panel` with a `/` (`/projects`): each package brings its own. */
  readonly panel?: readonly PanelCommand[];
  /** The app's root: no command, `--help`, `--version`, `__complete`, `__describe` and `__entries`. */
  readonly root?: ShellRoot;
}

/** What a panel command has: the container, the panel it was typed in, and the session's context. */
export interface PanelCommandContext {
  readonly container: Container;
  readonly panel: Pick<ChatPanel, 'write' | 'say' | 'choose'>;
  readonly context: PanelContext;
}

/** What the panel's session is acting on (`projeto`, `ticket`), and the cards it shows in the header about it. */
export interface PanelContext {
  get(key: string): string | undefined;
  /** Sets `key`, or removes it when `value` is undefined. */
  set(key: string, value: string | undefined): void;
  /**
   * Shows a card titled `title` in the header: its lines (escape codes kept), the summary it shows collapsed, and the
   * letter that opens or collapses it with Ctrl. Undefined hides it.
   */
  show(title: string, card: Omit<PanelCard, 'title'> | undefined): void;
  /**
   * Shows `name value` in the header's column, under its fixed lines, the name in gray and `value` as given (escape
   * codes kept); undefined removes it. The lines keep the order their names first came in.
   */
  label(name: string, value: string | undefined): void;
}

/** A command of the panel: the word after `/`, what it does in a line, and running it. */
export interface PanelCommand {
  readonly name: string;
  readonly description: string;
  /**
   * Why it cannot run now (`Escolha um projeto antes`), or nothing when it can: the panel shows it in the list in place
   * of what the command does. Asked as the person types, so it reads little.
   */
  readonly unavailable?: (context: PanelContext, container: Container) => string | undefined;
  readonly run: (context: PanelCommandContext) => Promise<void>;
}
