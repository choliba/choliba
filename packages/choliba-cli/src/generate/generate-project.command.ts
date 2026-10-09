import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { messageOf } from '@choliba/core';
import { CliCommand, CommandIo } from '@choliba/core/nest';
import { projectEnvExampleFile, projectEnvFile, type CreatedProject } from '@choliba/projects';

import { UsageError } from '../common';
import { parseGenerateProjectArgs } from './dto/generate-project.dto';
import { generateArgs } from './generate-args';
import { GENERATE_PROJECT_HELP } from './generate-spec';
import { GenerateService } from './generate.service';

/** Where the new project's `description` came from, or why it stayed empty. */
function describeCreated(created: CreatedProject, appDir: string): string {
  if (created.description !== undefined) {
    return `description preenchido a partir de ${String(created.readme)}: "${created.description}"\n`;
  }
  return created.readme === undefined
    ? `Nenhum README na raiz de ${appDir}; description ficou vazio.\n`
    : `${created.readme} não tem título nem parágrafo aproveitáveis; description ficou vazio.\n`;
}

/** `choliba generate project [PROJECT] --app-dir DIR [--base-url URL]`: a test project from the template. */
@SubCommand({ name: 'project', allowUnknownOptions: true, allowExcessArgs: true })
export class GenerateProjectCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(GenerateService) private readonly generate: GenerateService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const args = generateArgs(this.io.args(), 'project');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(GENERATE_PROJECT_HELP);
      return;
    }
    try {
      const created = await this.generate.project(parseGenerateProjectArgs(args));
      this.io.write(
        `Projeto "${created.project}" criado em ${created.dir}.\n${describeCreated(created.created, created.appDir)}`,
      );
      this.io.write(
        `Antes de usar: crie ${projectEnvFile(created.dir)} a partir de ${projectEnvExampleFile(created.dir)} ` +
          `e troque os valores CHANGE_ME (config.json e .env.json).\n`,
      );
    } catch (error) {
      if (error instanceof UsageError) this.io.usageError(error.message, 'choliba generate project');
      else this.io.fail(messageOf(error));
    }
  }
}
