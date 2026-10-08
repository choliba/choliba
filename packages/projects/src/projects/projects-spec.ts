import type { CommandSpec, Suggestions } from '@choliba/core';

import { NONE, PROGRAM_NAME } from '../common';
import {
  listTicketTypes,
  projectCompletions,
  ticketSpecsEntry,
  ticketsFolderEntry,
  ticketTemplatesDir,
} from '../tickets';

/**
 * The whole CLI as one spec: `--help` and shell completion are built from it, and the project and ticket names are
 * read from `projectsDir()` on every call, so they match what is on disk. The commands about tickets alone come from
 * the `tickets` module.
 */
export function projectsCliSpec(projectsDir: () => string): CommandSpec {
  const completions = projectCompletions(projectsDir);
  const { projectOnly, projectThenTicket } = completions;
  /** `PROJECT` first, then a ticket `TYPE`, then nothing. */
  const projectThenType = (previous: readonly string[]): Suggestions => {
    if (previous.length === 0) {
      return completions.projects();
    }
    return previous.length === 1 ? { kind: 'values', values: listTicketTypes(ticketTemplatesDir()) } : NONE;
  };

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
      {
        name: 'create-ticket',
        description: `Cria um ticket a partir do template do tipo (${listTicketTypes(ticketTemplatesDir()).join(', ')})`,
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} create-ticket PROJECT TYPE`, positionals: projectThenType },
      },
      {
        name: 'create-project',
        description: 'Cria um projeto novo a partir do template',
        group: 'Commands',
        spec: {
          usage: `${PROGRAM_NAME} create-project [PROJECT] --app-dir DIR [OPTIONS]`,
          flags: [
            {
              name: '--app-dir',
              description:
                'Pasta com o código da aplicação (obrigatória): precisa existir; relativa ao diretório atual. Sem PROJECT, o projeto leva o nome dela; o README na raiz dela vira o description',
              value: { name: 'dir', suggest: () => ({ kind: 'files' }) },
            },
            { name: '--base-url', description: 'URL base do projeto', value: { name: 'url' } },
          ],
        },
      },
    ],
    flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
    footer: `Run '${PROGRAM_NAME} COMMAND --help' for more information on a command.`,
  };
}
