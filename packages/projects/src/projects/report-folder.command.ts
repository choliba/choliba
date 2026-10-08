import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { runSubcommand } from '../common';
import { ProjectsService } from './projects.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'report-folder', ...OPTIONS })
export class ReportFolderCommand extends CliCommand {
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
      'report-folder',
      ([project, ticket]) => {
        this.io.write(`${this.projects.reportFolder(project, ticket)}\n`);
      },
    );
    return Promise.resolve();
  }
}
