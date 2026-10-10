import type { CommandEntry } from '../../help';
import type { Container } from '../container';
import type { ShellIo } from '../shell-io';

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
}
