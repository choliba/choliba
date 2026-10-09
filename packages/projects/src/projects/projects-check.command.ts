import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { runSubcommand, UsageError } from '../common';

import { ProjectsService } from './projects.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'check', ...OPTIONS })
export class ProjectsCheckCommand extends CliCommand {
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
      'check',
      ([project]) => {
        if (!project) throw new UsageError('Missing project for check.');
        const { config, environment } = this.projects.check(project);
        this.io.write(
          `Projeto "${project}" (${config.name}) pronto: ambiente ${environment.nome}, ${environment.baseURL}\n`,
        );
      },
    );
    return Promise.resolve();
  }
}
