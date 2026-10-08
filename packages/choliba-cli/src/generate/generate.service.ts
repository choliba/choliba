import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@choliba/core/nest';
import {
  createProject,
  createTicket,
  listTicketTypes,
  loadProjectSettings,
  projectDir,
  projectTemplatesDir,
  ticketTemplatesDir,
  type CreatedProject,
  type NewTicket,
} from '@choliba/projects';
import { LocationsService } from '@choliba/projects/nest';

import type { GenerateProjectDto } from './dto/generate-project.dto';
import type { GenerateTicketDto } from './dto/generate-ticket.dto';

/** The project just created, and the folder it lives in. */
export interface GeneratedProject {
  readonly created: CreatedProject;
  readonly dir: string;
}

/** `choliba generate project|ticket`, in the workspace the command runs in. */
@Injectable()
export class GenerateService {
  constructor(
    @Inject(LocationsService) private readonly locations: LocationsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  /** Where a relative `--app-dir` counts from: the folder the command was run in. */
  startDir(): string {
    return this.config.startDir();
  }

  project(dto: GenerateProjectDto): GeneratedProject {
    const projectsDir = this.locations.projectsDir();
    const created = createProject(projectsDir, dto.project, projectTemplatesDir(), {
      appDir: dto.appDir,
      ...(dto.baseUrl === undefined ? {} : { baseUrl: dto.baseUrl }),
    });
    return { created, dir: projectDir(projectsDir, dto.project) };
  }

  /** A ticket from the template of `dto.type`, in the active environment of a ready project. */
  ticket(dto: GenerateTicketDto): NewTicket {
    const projectsDir = this.locations.projectsDir();
    const environment = loadProjectSettings(projectsDir, dto.project).environment.nome;
    return createTicket(projectsDir, dto.project, dto.type, ticketTemplatesDir(), { environment });
  }

  /** The ticket types of the templates, for the help. */
  ticketTypes(): readonly string[] {
    return listTicketTypes(ticketTemplatesDir());
  }
}
