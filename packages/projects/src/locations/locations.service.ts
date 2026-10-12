import type { ConfigService, Environment } from '@choliba/core';

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
}
