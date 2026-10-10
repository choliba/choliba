import { messageOf, type CommandSpec, type ShellIo, type Suggestions } from '@choliba/core';

import { UsageError } from './errors';

/** The CLI `choliba projects`, whose commands the `projects` and `tickets` modules share. */
export const PROGRAM_NAME = 'choliba projects';

/** No suggestion. */
export const NONE: Suggestions = { kind: 'values', values: [] };

/** The help of one command of `spec`, described by the line `--help` lists it with. */
export function commandHelp(spec: CommandSpec, name: string): CommandSpec {
  const entry = spec.commands?.().find((candidate) => candidate.name === name);
  return entry === undefined ? spec : { ...entry.spec, description: entry.description };
}

/**
 * The part every `choliba projects <name>` shares: its arguments as typed, `--help` from the spec, a usage
 * error with where to read the usage, and any other error as a message on stderr with exit code 1.
 */
export function runSubcommand(
  io: ShellIo,
  spec: () => CommandSpec,
  name: string,
  body: (args: readonly string[]) => void,
): void {
  const args = io.args('projects', name);
  if (io.wantsHelp(args)) {
    io.printHelp(commandHelp(spec(), name));
    return;
  }
  try {
    body(args);
  } catch (error) {
    const message = messageOf(error);
    if (error instanceof UsageError) {
      io.usageError(message, PROGRAM_NAME);
      return;
    }
    io.fail(message);
  }
}
