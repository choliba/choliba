import type { CommandEntry, RootSpec } from '../../help';
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
  /** The order of the root's sections. Sections it does not name come last. */
  readonly groups?: readonly string[];
  /** The order of the commands inside a section, by name. Names it does not list come after, as they were registered. */
  readonly order?: readonly string[];
  /**
   * Called before the local `__complete`. A string is printed as the answer; `undefined` completes from this CLI.
   */
  readonly delegateComplete?: (words: readonly string[]) => string | undefined;
}

/** A command of the shell: the first word that runs it, its help entries, and what it does. */
export interface ShellCommand {
  /** The first word on the command line (`terminal` of `choliba terminal run …`). */
  readonly name: string;
  /** Other first words that run it. */
  readonly aliases?: readonly string[];
  /** Its entries in the app's root help and completion, asked for every time (they may read the workspace). */
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
  readonly commands: readonly ShellCommand[];
  /** The app's root: no command, `--help`, `--version`, `__complete`, `__describe` and `__entries`. */
  readonly root?: ShellRoot;
  /**
   * Runs a first word that is no command, with the whole command line (`choliba <agent> …`). At most one module of an
   * app has it; without one, such a word is a usage error.
   */
  readonly fallback?: (container: Container, io: ShellIo) => Promise<void>;
}
