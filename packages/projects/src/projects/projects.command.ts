import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { PROGRAM_NAME } from '../common';
import { TicketSpecsCommand, TicketsFolderCommand } from '../tickets/nest';

import { CheckProjectCommand } from './check-project.command';
import { CreateProjectCommand } from './create-project.command';
import { CreateTicketCommand } from './create-ticket.command';
import { ListProjectsCommand } from './list-projects.command';
import { ProjectsService } from './projects.service';
import { ReportFolderCommand } from './report-folder.command';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** How `choliba --help` lists `projects`; its spec is built from the workspace when asked for. */
const ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'projects',
  description: 'Cria e lista projetos e tickets em CHOL_PROJECTS_DIR',
  group: 'Commands',
};

/** `choliba projects`: its help, or what is wrong when no known command follows. */
@RegisterHelp()
@Command({
  name: 'projects',
  description: 'Cria e lista projetos e tickets em CHOL_PROJECTS_DIR',
  subCommands: [
    ListProjectsCommand,
    CheckProjectCommand,
    ReportFolderCommand,
    CreateProjectCommand,
    TicketsFolderCommand,
    TicketSpecsCommand,
    CreateTicketCommand,
  ],
  ...OPTIONS,
})
export class ProjectsCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [{ ...ENTRY, spec: this.projects.helpSpec() }];
  }

  async run(): Promise<void> {
    const [command] = this.io.args('projects');
    if (command === undefined) {
      this.io.usageError('Missing command.', PROGRAM_NAME);
    } else if (command === '--help' || command === '-h' || command === 'help') {
      this.io.printHelp(this.projects.helpSpec());
    } else {
      this.io.usageError(`Unknown command "${command}".`, PROGRAM_NAME);
    }
    return Promise.resolve();
  }
}
