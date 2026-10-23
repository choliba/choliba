import type { ShellModule } from '@choliba/shell';

import { projectsConfig } from '@choliba/workspace';
import { PROJECTS } from '@choliba/tui';
import { LocationsService } from './locations.service';
import { ProjectsService } from './projects.service';

/** The project's configuration and service registrations. The app owns its CLI commands. */
export const projectsShell: ShellModule = {
  name: '@choliba/projects',
  config: [projectsConfig],
  provide: (container) => {
    container.provide(PROJECTS, (c) => new ProjectsService(new LocationsService(c.get(projectsConfig.token))));
  },
  commands: [],
};
