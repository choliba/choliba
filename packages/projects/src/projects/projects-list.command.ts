import { formatRows, type CommandEntry, type ShellCommand, type ShellIo } from '@choliba/core';

import { runSubcommand } from '../common';
import { listProjectsSpec } from './projects-spec';
import { PROJECTS } from './projects.constants';
import type { ProjectsService } from './projects.service';

/** `choliba list projects [--tickets]`. */
export function runProjectsList(io: ShellIo, projects: ProjectsService): void {
  runSubcommand(io, ['list', 'projects'], listProjectsSpec, (args) => {
    const found = projects.list();
    if (found.length === 0) {
      io.write(`Nenhum projeto encontrado em ${projects.projectsDir()}.\n`);
      return;
    }
    if (args.includes('--tickets')) {
      // One `project ["key", …]` line per project: the product-owner agent reads this format.
      for (const { name, tickets } of projects.listWithTickets()) {
        io.write(`${name} ${JSON.stringify(tickets)}\n`);
      }
      return;
    }
    io.write(`${formatRows(found.map(({ name, description }) => [name, description]))}\n`);
  });
}

/** How `choliba list --help` lists `projects`. */
const LIST_ENTRY: CommandEntry = {
  name: 'projects',
  description: 'Lista os projetos de CHOL_PROJECTS_DIR',
  group: 'Commands',
  spec: listProjectsSpec(),
};

/** `choliba list projects [--tickets]`. */
export const listProjectsCommand: ShellCommand = {
  verb: 'list',
  name: 'projects',
  help: () => [LIST_ENTRY],
  run: (container, io) => {
    runProjectsList(io, container.get(PROJECTS));
    return Promise.resolve();
  },
};
