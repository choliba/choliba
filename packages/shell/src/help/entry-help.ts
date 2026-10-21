import type { CommandEntry, CommandSpec } from './interfaces/help.interface';

/** `<app> <command> --help` of a command: its spec, described by the line the root help lists it with. */
export function entryHelp(entry: CommandEntry): CommandSpec {
  return { ...entry.spec, description: entry.spec.description ?? entry.description };
}
