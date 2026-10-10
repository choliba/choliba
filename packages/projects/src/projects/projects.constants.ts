import { token } from '@choliba/core';

import type { LocationsService } from '../locations';
import type { TicketsService } from '../tickets';
import type { ProjectsService } from './projects.service';

/** Where the projects under test live, from the workspace and the process. */
export const LOCATIONS = token<LocationsService>('LocationsService');

/** What runs `choliba projects` for the projects themselves. */
export const PROJECTS = token<ProjectsService>('ProjectsService');

/** What runs the `choliba projects` commands about tickets. */
export const TICKETS = token<TicketsService>('TicketsService');
