import type { CommandSpec, Suggestions } from '@choliba/core/cli';

import { listProjectNames } from './project';
import { listTicketKeys } from '../tickets/ticket';
import { listTicketTypes, ticketTemplatesDir } from '../tickets/ticket-template';

export const PROGRAM_NAME = 'choliba projects';

const NONE: Suggestions = { kind: 'values', values: [] };

/**
 * The whole CLI as one spec: `--help` and shell completion are built from it, and the project
 * and ticket names are read from `projectsDir()` on every call, so they match what is on disk.
 */
export function projectsCliSpec(projectsDir: () => string): CommandSpec {
  const projects = (): Suggestions => {
    try {
      return { kind: 'values', values: listProjectNames(projectsDir()) };
    } catch {
      return NONE;
    }
  };
  const tickets = (project: string): Suggestions => {
    try {
      return { kind: 'values', values: listTicketKeys(projectsDir(), project) };
    } catch {
      return NONE;
    }
  };
  /** `PROJECT` first, then `TICKET` of that project, then nothing. */
  const projectThenTicket = (previous: readonly string[]): Suggestions => {
    const [project, ...rest] = previous;
    if (project === undefined) {
      return projects();
    }
    return rest.length === 0 ? tickets(project) : NONE;
  };
  const projectOnly = (previous: readonly string[]): Suggestions => (previous.length === 0 ? projects() : NONE);
  /** `PROJECT` first, then a ticket `TYPE`, then nothing. */
  const projectThenType = (previous: readonly string[]): Suggestions => {
    if (previous.length === 0) {
      return projects();
    }
    return previous.length === 1 ? { kind: 'values', values: listTicketTypes(ticketTemplatesDir()) } : NONE;
  };

  return {
    usage: `${PROGRAM_NAME} COMMAND [ARGS]`,
    description: 'Resolve pastas e arquivos dos projetos Playwright em CHOL_PROJECTS_DIR.',
    commands: () => [
      {
        name: 'tickets-folder',
        description: 'Mostra a pasta de tickets de um projeto',
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} tickets-folder PROJECT`, positionals: projectOnly },
      },
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
      {
        name: 'ticket-specs',
        description: 'Lista os arquivos de spec de um ticket',
        group: 'Commands',
        spec: { usage: `${PROGRAM_NAME} ticket-specs PROJECT TICKET`, positionals: projectThenTicket },
      },
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

/** The help of one command of `spec`, described by the line `--help` lists it with. */
export function commandHelp(spec: CommandSpec, name: string): CommandSpec {
  const entry = spec.commands?.().find((candidate) => candidate.name === name);
  return entry === undefined ? spec : { ...entry.spec, description: entry.description };
}
