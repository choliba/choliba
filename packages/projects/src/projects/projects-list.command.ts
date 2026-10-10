import { formatRows, type ShellIo } from '@choliba/core';

import { runSubcommand } from '../common';
import type { ProjectsService } from './projects.service';

/** `choliba projects list [--tickets]`. */
export function runProjectsList(io: ShellIo, projects: ProjectsService): void {
  runSubcommand(
    io,
    () => projects.helpSpec(),
    'list',
    (args) => {
      const found = projects.list();
      if (found.length === 0) {
        io.write(`No project found in ${projects.projectsDir()}.\n`);
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
    },
  );
}
