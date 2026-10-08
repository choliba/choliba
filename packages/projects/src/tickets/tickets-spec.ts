import type { CommandEntry, CommandSpec, Suggestions } from '@choliba/core';

import { listProjectNames } from '../paths';
import { NONE, PROGRAM_NAME } from '../common';
import { listTicketKeys } from './ticket';

/** The completions of `choliba projects` that read the projects and their tickets on disk, on every call. */
export interface ProjectCompletions {
  /** `PROJECT`, then nothing. */
  readonly projectOnly: (previous: readonly string[]) => Suggestions;
  /** `PROJECT`, then `TICKET` of that project, then nothing. */
  readonly projectThenTicket: (previous: readonly string[]) => Suggestions;
  /** The projects of the projects folder. */
  readonly projects: () => Suggestions;
}

/** What a read of the workspace suggests, or nothing when the projects folder cannot be read. */
function suggest(read: () => readonly string[]): Suggestions {
  try {
    return { kind: 'values', values: read() };
  } catch {
    return NONE;
  }
}

export function projectCompletions(projectsDir: () => string): ProjectCompletions {
  const projects = (): Suggestions => suggest(() => listProjectNames(projectsDir()));
  return {
    projects,
    projectOnly: (previous) => (previous.length === 0 ? projects() : NONE),
    projectThenTicket: (previous) => {
      const [project, ...rest] = previous;
      if (project === undefined) return projects();
      return rest.length === 0 ? suggest(() => listTicketKeys(projectsDir(), project)) : NONE;
    },
  };
}

/** The `choliba projects` commands about tickets alone, as `--help` lists them. */
export function ticketsFolderEntry(completions: ProjectCompletions): CommandEntry {
  return {
    name: 'tickets-folder',
    description: 'Mostra a pasta de tickets de um projeto',
    group: 'Commands',
    spec: { usage: `${PROGRAM_NAME} tickets-folder PROJECT`, positionals: completions.projectOnly },
  };
}

export function ticketSpecsEntry(completions: ProjectCompletions): CommandEntry {
  return {
    name: 'ticket-specs',
    description: 'Lista os arquivos de spec de um ticket',
    group: 'Commands',
    spec: { usage: `${PROGRAM_NAME} ticket-specs PROJECT TICKET`, positionals: completions.projectThenTicket },
  };
}

/** The spec the `tickets` commands print their `--help` from: their own entries of `choliba projects`. */
export function ticketsCliSpec(projectsDir: () => string): CommandSpec {
  const completions = projectCompletions(projectsDir);
  return {
    usage: `${PROGRAM_NAME} COMMAND [ARGS]`,
    commands: () => [ticketsFolderEntry(completions), ticketSpecsEntry(completions)],
  };
}
