import type { CommandSpec } from '@choliba/core';

import { PROGRAM_NAME } from '../common';
import { projectCompletions, ticketSpecsEntry, ticketsFolderEntry } from '../tickets';

/**
 * The whole CLI as one spec: `--help` and shell completion are built from it, and the project and ticket names are
 * read from `projectsDir()` on every call, so they match what is on disk. The commands about tickets alone come from
 * the `tickets` module.
 */
export function projectsCliSpec(projectsDir: () => string): CommandSpec {
  const completions = projectCompletions(projectsDir);
  const { projectOnly, projectThenTicket } = completions;

  return {
    usage: `${PROGRAM_NAME} COMMAND [ARGS]`,
    description: 'Resolve pastas e arquivos dos projetos Playwright em CHOL_PROJECTS_DIR.',
    commands: () => [
      ticketsFolderEntry(completions),
      {
        name: 'check-project',
        description: 'Confere se um projeto está pronto para rodar (arquivos, ambiente, sem CHANGE_ME)',
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} check-project PROJECT`, positionals: projectOnly },
      },
      {
        name: 'report-folder',
        description: 'Mostra a pasta de relatório (padrão, de um projeto ou de um ticket)',
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} report-folder [PROJECT] [TICKET]`, positionals: projectThenTicket },
      },
      ticketSpecsEntry(completions),
      {
        name: 'list-projects',
        description: 'Lista os projetos',
        group: 'Commands',
        spec: {
          usage: `${PROGRAM_NAME} list-projects [OPTIONS]`,
          flags: [{ name: '--tickets', description: 'Mostra também os tickets de cada projeto' }],
        },
      },
    ],
    flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
    footer: `Run '${PROGRAM_NAME} COMMAND --help' for more information on a command.`,
  };
}
