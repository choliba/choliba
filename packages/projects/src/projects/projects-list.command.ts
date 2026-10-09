import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { formatRows } from '@choliba/core';

import { runSubcommand } from '../common';
import { ProjectsService } from './projects.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'list', ...OPTIONS })
export class ProjectsListCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {
    super();
  }

  async run(): Promise<void> {
    runSubcommand(
      this.io,
      () => this.projects.helpSpec(),
      'list',
      (args) => {
        const projects = this.projects.list();
        if (projects.length === 0) {
          this.io.write(`No project found in ${this.projects.projectsDir()}.\n`);
          return;
        }
        if (args.includes('--tickets')) {
          // One `project ["key", …]` line per project: the product-owner agent reads this format.
          for (const { name, tickets } of this.projects.listWithTickets()) {
            this.io.write(`${name} ${JSON.stringify(tickets)}\n`);
          }
          return;
        }
        this.io.write(`${formatRows(projects.map(({ name, description }) => [name, description]))}\n`);
      },
    );
    return Promise.resolve();
  }
}
