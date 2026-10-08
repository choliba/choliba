import { Inject } from '@nestjs/common';
import { Command, SubCommand } from 'nest-commander';

import { formatRows } from '@choliba/core';
import { CliCommand, CommandIo, ConfigService } from '@choliba/core/nest';

import { UsageError } from '../shared/errors';
import { CreateTicketCommand, TicketSpecsCommand, TicketsFolderCommand } from '../tickets/tickets.command';
import { parseCreateProjectArgs } from './dto/create-project.dto';
import { projectEnvExampleFile, projectEnvFile, type CreatedProject } from './project';
import { PROGRAM_NAME } from './projects.help';
import { ProjectsService } from './projects.service';
import { runSubcommand } from './run-subcommand';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'list-projects', ...OPTIONS })
export class ListProjectsCommand extends CliCommand {
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
      'list-projects',
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

@SubCommand({ name: 'check-project', ...OPTIONS })
export class CheckProjectCommand extends CliCommand {
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
      'check-project',
      ([project]) => {
        if (!project) throw new UsageError('Missing project for check-project.');
        const { config, environment } = this.projects.check(project);
        this.io.write(
          `Projeto "${project}" (${config.name}) pronto: ambiente ${environment.nome}, ${environment.baseURL}\n`,
        );
      },
    );
    return Promise.resolve();
  }
}

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

/** `choliba projects`: its help, or what is wrong when no known command follows. */
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
export class ProjectsCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {
    super();
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
