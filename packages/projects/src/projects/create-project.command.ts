import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo, ConfigService } from '@choliba/core/nest';

import { projectEnvExampleFile, projectEnvFile } from '../paths';
import type { CreatedProject } from './project';
import { parseCreateProjectArgs } from './dto/create-project.dto';

import { runSubcommand } from '../common';
import { ProjectsService } from './projects.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** Where the new project's `description` came from, or why it stayed empty. */
function describeCreated(created: CreatedProject, appDir: string): string {
  if (created.description !== undefined) {
    return `description preenchido a partir de ${String(created.readme)}: "${created.description}"\n`;
  }
  return created.readme === undefined
    ? `Nenhum README na raiz de ${appDir}; description ficou vazio.\n`
    : `${created.readme} não tem título nem parágrafo aproveitáveis; description ficou vazio.\n`;
}

@SubCommand({ name: 'create-project', ...OPTIONS })
export class CreateProjectCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    super();
  }

  async run(): Promise<void> {
    runSubcommand(
      this.io,
      () => this.projects.helpSpec(),
      'create-project',
      (args) => {
        const dto = parseCreateProjectArgs(args, this.config.startDir());
        const { created, dir } = this.projects.create(dto);
        this.io.write(`Projeto "${dto.project}" criado em ${dir}.\n${describeCreated(created, dto.appDir)}`);
        this.io.write(
          `Antes de usar: crie ${projectEnvFile(dir)} a partir de ${projectEnvExampleFile(dir)} ` +
            `e troque os valores CHANGE_ME (config.json e .env.json).\n`,
        );
      },
    );
    return Promise.resolve();
  }
}
