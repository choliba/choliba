import type { CommandIo } from '@choliba/core/nest';
import { messageOf, type CommandSpec } from '@choliba/core';

import { UsageError } from '../shared/errors';
import { commandHelp, PROGRAM_NAME } from './projects.help';

/**
 * The part every `choliba projects <name>` shares: its arguments as typed, `--help` from the spec, a usage
 * error with where to read the usage, and any other error as a message on stderr with exit code 1.
 */
export function runSubcommand(
  io: CommandIo,
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
