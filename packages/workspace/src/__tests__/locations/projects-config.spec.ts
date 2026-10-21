import { join } from 'node:path';

import { envSource } from '@choliba/config';

import { LocationsError, projectLocations, projectsConfig } from '../../index';

describe('projectsConfig', () => {
  it('derives the projects folder from the global folder', () => {
    const read = projectsConfig.read([envSource({ CHOL_GLOBAL_DIR: '/tmp/global' })]);

    expect(projectLocations(read)).toEqual({
      CHOL_GLOBAL_DIR: '/tmp/global',
      CHOL_PROJECTS_DIR: join('/tmp/global', 'projects'),
    });
  });

  it('keeps an explicit projects folder and ticket runs', () => {
    const read = projectsConfig.read([
      envSource({
        CHOL_GLOBAL_DIR: '  /tmp/global  ',
        CHOL_PROJECTS_DIR: '/tmp/projetos',
        CHOL_TICKET_RUNS: ' /tmp/runs ',
      }),
    ]);

    expect(projectLocations(read)).toEqual({
      CHOL_GLOBAL_DIR: '/tmp/global',
      CHOL_PROJECTS_DIR: '/tmp/projetos',
      CHOL_TICKET_RUNS: '/tmp/runs',
    });
  });

  it('ignores a blank projects folder and blank ticket runs', () => {
    const read = projectsConfig.read([
      envSource({ CHOL_GLOBAL_DIR: '/tmp/global', CHOL_PROJECTS_DIR: '  ', CHOL_TICKET_RUNS: ' ' }),
    ]);

    expect(projectLocations(read)).toEqual({
      CHOL_GLOBAL_DIR: '/tmp/global',
      CHOL_PROJECTS_DIR: join('/tmp/global', 'projects'),
    });
  });

  it('fails when the global folder is missing', () => {
    expect(() => projectLocations(projectsConfig.read([]))).toThrow(LocationsError);
    expect(() => projectLocations(projectsConfig.read([envSource({ CHOL_GLOBAL_DIR: '  ' })]))).toThrow(
      'CHOL_GLOBAL_DIR não definida',
    );
  });
});
