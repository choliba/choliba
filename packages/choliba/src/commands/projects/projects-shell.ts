import type { ShellModule } from '@choliba/core';

import { listProjectsCommand } from './projects-list.command';
import { newProjectCommand } from './projects-new.command';

/** The app-owned commands that use the projects package's service. */
export const projectsCommandsShell: ShellModule = {
  name: 'choliba-projects-commands',
  commands: [newProjectCommand, listProjectsCommand],
};
