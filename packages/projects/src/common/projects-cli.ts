import { messageOf, type CommandSpec, type ShellIo, type Suggestions } from '@choliba/core';

/** No suggestion. */
export const NONE: Suggestions = { kind: 'values', values: [] };

/** The program a command `path` (`['list', 'projects']`) is, for usage errors: `choliba list projects`. */
export function programOf(path: readonly string[]): string {
  return ['choliba', ...path].join(' ');
}

/**
 * The part the commands of this package share: their arguments after `path` as typed, `--help` from the spec, and
 * any error as a message on stderr with exit code 1.
 */
export function runSubcommand(
  io: ShellIo,
  path: readonly string[],
  spec: () => CommandSpec,
  body: (args: readonly string[]) => void,
): void {
  const args = io.args(...path);
  if (io.wantsHelp(args)) {
    io.printHelp(spec());
    return;
  }
  try {
    body(args);
  } catch (error) {
    io.fail(messageOf(error));
  }
}
