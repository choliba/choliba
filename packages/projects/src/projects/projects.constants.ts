import { token } from '@choliba/core';

import type { LocationsService } from '../locations';
import type { ProjectsService } from './projects.service';

/** Where the projects under test live, from the workspace and the process. */
export const LOCATIONS = token<LocationsService>('LocationsService');

/** What creates, lists and checks the projects. */
export const PROJECTS = token<ProjectsService>('ProjectsService');
