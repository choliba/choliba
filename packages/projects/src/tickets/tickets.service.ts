import { Inject, Injectable } from '@nestjs/common';

import type { CommandSpec } from '@choliba/core';

import { LocationsService } from '../locations/nest';
import { resolveTicketSpecFiles, resolveTicketsFolder } from './ticket';
import { ticketsCliSpec } from './tickets-spec';

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

  /** `--help` and completion of the `choliba projects` commands about tickets alone. */
  helpSpec(): CommandSpec {
    return ticketsCliSpec(() => this.locations.projectsDir());
  }
}
