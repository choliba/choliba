import type { ShellModule } from '@choliba/core';

import { projectsConfig } from '../paths';
import { LocationsService } from '../locations';
import { LOCATIONS, PROJECTS } from './projects.constants';
import { ProjectsService } from './projects.service';

/** @choliba/projects' configuration and service registrations. The app owns its CLI commands. */
export const projectsShell: ShellModule = {
  name: '@choliba/projects',
  config: [projectsConfig],
  provide: (container) => {
    container.provide(LOCATIONS, (c) => new LocationsService(c.get(projectsConfig.token)));
    container.provide(PROJECTS, (c) => new ProjectsService(c.get(LOCATIONS)));
  },
  commands: [],
};
