import { projectLocations, type ProjectLocations, type projectsConfig } from '../paths';

/** Where the projects under test live, from the workspace's `.env` and the process environment. */
export class LocationsService {
  constructor(private readonly config: ReturnType<typeof projectsConfig.read>) {}

  locations(): ProjectLocations {
    return projectLocations(this.config);
  }

  projectsDir(): string {
    return this.locations().CHOL_PROJECTS_DIR;
  }
}
