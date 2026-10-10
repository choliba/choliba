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
        name: 'check',
        description: 'Confere se um projeto está pronto para rodar (arquivos, ambiente, sem CHANGE_ME)',
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} check PROJECT`, positionals: projectOnly },
      },
      {
        name: 'report-folder',
        description: 'Mostra a pasta de relatório (padrão, de um projeto ou de um ticket)',
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} report-folder [PROJECT] [TICKET]`, positionals: projectThenTicket },
      },
      ticketSpecsEntry(completions),
      {
        name: 'new',
        description: 'Cria um projeto a partir do modelo; o que faltar é perguntado no terminal',
        group: 'Commands',
        spec: {
          usage: `${PROGRAM_NAME} new [NOME] [OPTIONS]`,
          flags: [
            {
              name: '--app-dir',
              value: { name: 'pasta', suggest: () => ({ kind: 'files' }) },
              description: 'Pasta da aplicação; o nome do projeto sai dela quando falta NOME',
            },
            { name: '--base-url', value: { name: 'url' }, description: 'URL base da aplicação' },
            { name: '--no-input', description: 'Não pergunta nada: o que faltar fica CHANGE_ME' },
          ],
        },
      },
      {
        name: 'list',
        description: 'Lista os projetos',
        group: 'Commands',
        spec: {
          usage: `${PROGRAM_NAME} list [OPTIONS]`,
          flags: [{ name: '--tickets', description: 'Mostra também os tickets de cada projeto' }],
        },
      },
    ],
    flags: [{ name: '--help', aliases: ['-h'], description: 'Mostra esta ajuda', terminal: true }],
    footer: `Run '${PROGRAM_NAME} COMMAND --help' for more information on a command.`,
  };
}
