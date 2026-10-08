import { Inject, Injectable } from '@nestjs/common';

import { ConfigService } from '@choliba/core/nest';
import { ENV, type Environment } from '@choliba/core';

import { resolveTicketRunsRoot } from '../tickets/ticket';
import { resolveLocations, type ProjectLocations } from './locations';

/** Where the projects under test live, from the workspace's `.env` and the process environment. */
@Injectable()
export class LocationsService {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ENV) private readonly env: Environment,
  ) {}

  locations(): ProjectLocations {
    return resolveLocations(this.config.workspaceRoot(), this.env);
  }

  projectsDir(): string {
    return this.locations().CHOL_PROJECTS_DIR;
  }

  /** The root of `ticket-runs/`: `CHOL_TICKET_RUNS`, or the projects folder. */
  ticketRunsRoot(): string {
    return resolveTicketRunsRoot(this.locations());
  }
}
