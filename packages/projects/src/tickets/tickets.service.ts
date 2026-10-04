import { Inject, Injectable } from '@nestjs/common';

import type { CommandSpec } from '@choliba/core/cli';

import { LocationsService } from '../locations/locations.service';
import { projectsCliSpec } from '../projects/projects.help';
import { loadProjectSettings } from '../projects/settings';
import type { CreateTicketDto } from './dto/create-ticket.dto';
import { resolveTicketSpecFiles, resolveTicketsFolder } from './ticket';
import { createTicket, ticketTemplatesDir, type NewTicket } from './ticket-template';

/** The tickets of a project: where they are, their specs, and new ones from a type's template. */
@Injectable()
export class TicketsService {
  constructor(@Inject(LocationsService) private readonly locations: LocationsService) {}

  folder(project: string): string {
    return resolveTicketsFolder(this.locations.projectsDir(), project);
  }

  specFiles(project: string, ticket: string): readonly string[] {
    return resolveTicketSpecFiles(this.locations.projectsDir(), project, ticket);
  }

  /** A ticket from the template of `dto.type`, in the active environment of a ready project. */
  create(dto: CreateTicketDto): NewTicket {
    const projectsDir = this.locations.projectsDir();
    const settings = loadProjectSettings(projectsDir, dto.project);
    return createTicket(projectsDir, dto.project, dto.type, ticketTemplatesDir(), {
      environment: settings.environment.nome,
    });
  }

  /** `--help` and completion of `choliba projects`, which these commands belong to. */
  helpSpec(): CommandSpec {
    return projectsCliSpec(() => this.locations.projectsDir());
  }
}
