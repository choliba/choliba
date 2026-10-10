import { CONFIG, PLATFORM, type ShellModule } from '@choliba/core';

import { LocationsService } from '../locations';
import { TicketsService } from '../tickets';
import { projectsCommand } from './projects.command';
import { LOCATIONS, PROJECTS, TICKETS } from './projects.constants';
import { ProjectsService } from './projects.service';

/** @choliba/projects in the shell: `choliba projects`. */
export const projectsShell: ShellModule = {
  name: '@choliba/projects',
  provide: (container) => {
    container.provide(LOCATIONS, (c) => new LocationsService(c.get(CONFIG), c.get(PLATFORM).env));
    container.provide(PROJECTS, (c) => new ProjectsService(c.get(LOCATIONS)));
    container.provide(TICKETS, (c) => new TicketsService(c.get(LOCATIONS)));
  },
  commands: [projectsCommand],
};
