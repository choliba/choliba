import { join } from 'node:path';

import { envSource, fileSource } from '@choliba/config';
import { ENV_FILE, type ConfigService, type Environment } from '@choliba/core';

import { projectLocations, projectsConfig, type ProjectLocations } from '../paths';

/** Where the projects under test live, from the workspace's `.env` and the process environment. */
export class LocationsService {
  constructor(
    private readonly config: ConfigService,
    private readonly env: Environment,
  ) {}

  locations(): ProjectLocations {
    const root = this.config.workspaceRoot();
    const read = projectsConfig.read([envSource(this.env), fileSource(join(root, ENV_FILE))]);
    return projectLocations(read);
  }

  projectsDir(): string {
    return this.locations().CHOL_PROJECTS_DIR;
  }
}
