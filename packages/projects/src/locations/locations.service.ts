import type { ConfigService, Environment } from '@choliba/core';

import { resolveTicketRunsRoot } from '../tickets';
import { resolveLocations, type ProjectLocations } from '../paths';

/** Where the projects under test live, from the workspace's `.env` and the process environment. */
export class LocationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly env: Environment,
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
