import type { ShellModule } from '@choliba/core';

import { projectsConfig } from '../paths';
import { LocationsService } from '../locations';
import { listProjectsCommand } from './projects-list.command';
import { newProjectCommand } from './projects-new.command';
import { projectsPanel } from './projects-panel';
import { LOCATIONS, PROJECTS } from './projects.constants';
import { ProjectsService } from './projects.service';

/** @choliba/projects in the shell: `choliba new project`, `choliba list projects`, and `/projects` and `/tickets` in the panel. */
export const projectsShell: ShellModule = {
  name: '@choliba/projects',
  config: [projectsConfig],
  provide: (container) => {
    container.provide(LOCATIONS, (c) => new LocationsService(c.get(projectsConfig.token)));
    container.provide(PROJECTS, (c) => new ProjectsService(c.get(LOCATIONS)));
  },
  commands: [newProjectCommand, listProjectsCommand],
  panel: projectsPanel,
};
