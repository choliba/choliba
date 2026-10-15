import { join } from 'node:path';

import { PROJECTS_SUBDIR } from '@choliba/core';

import { applyLocations, CHOL_GLOBAL_DIR, CHOL_PROJECTS_DIR, CHOL_TICKET_RUNS, resolveProjectsDir } from '../../index';

describe('resolveProjectsDir', () => {
  it('defaults to {CHOL_GLOBAL_DIR}/projects', () => {
    expect(resolveProjectsDir('/tmp/global')).toBe(join('/tmp/global', PROJECTS_SUBDIR));
  });

  it('honors an explicit override', () => {
    expect(resolveProjectsDir('/tmp/global', '/custom/projects')).toBe('/custom/projects');
  });
});

describe('applyLocations', () => {
  it('writes every configured location into process.env', () => {
    const previous = {
      global: process.env[CHOL_GLOBAL_DIR],
      projects: process.env[CHOL_PROJECTS_DIR],
      runs: process.env[CHOL_TICKET_RUNS],
    };
    try {
      applyLocations({
        CHOL_GLOBAL_DIR: '/global',
        CHOL_PROJECTS_DIR: '/projetos',
        CHOL_TICKET_RUNS: '/runs',
      });
      expect(process.env[CHOL_GLOBAL_DIR]).toBe('/global');
      expect(process.env[CHOL_PROJECTS_DIR]).toBe('/projetos');
      expect(process.env[CHOL_TICKET_RUNS]).toBe('/runs');
    } finally {
      process.env[CHOL_GLOBAL_DIR] = previous.global;
      process.env[CHOL_PROJECTS_DIR] = previous.projects;
      process.env[CHOL_TICKET_RUNS] = previous.runs;
    }
  });

  it('removes CHOL_TICKET_RUNS when absent', () => {
    process.env[CHOL_TICKET_RUNS] = '/old';
    applyLocations({ CHOL_GLOBAL_DIR: '/global', CHOL_PROJECTS_DIR: '/projetos' });
    expect(process.env[CHOL_TICKET_RUNS]).toBeUndefined();
  });
});
