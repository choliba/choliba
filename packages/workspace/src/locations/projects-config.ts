import { join } from 'node:path';

import { defineConfig } from '@choliba/config';

import { PROJECTS_SUBDIR } from '../layout';

/** The projects group's keys: where artifacts, projects and ticket runs live. */
export const projectsConfig = defineConfig('projects', {
  globalDir: {
    env: 'CHOL_GLOBAL_DIR',
    type: 'string',
    description: 'raiz dos artefatos e, sem CHOL_PROJECTS_DIR, dos projetos',
  },
  projectsDir: {
    env: 'CHOL_PROJECTS_DIR',
    type: 'string',
    description: 'pasta dos projetos',
    default: (previous) => {
      const globalDir = previous['globalDir'];
      if (typeof globalDir !== 'string') return undefined;
      const trimmed = globalDir.trim();
      return trimmed === '' ? undefined : join(trimmed, PROJECTS_SUBDIR);
    },
  },
  ticketRuns: {
    env: 'CHOL_TICKET_RUNS',
    type: 'string',
    description: 'raiz de ticket-runs/',
  },
});
