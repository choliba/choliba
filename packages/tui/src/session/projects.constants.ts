import { token } from '@choliba/kernel';

import type { ProjectsService } from './interfaces';

export const PROJECTS = token<ProjectsService>('ProjectsService');
