import { join } from 'node:path';

import fs from 'node:fs';
import os from 'node:os';

import { GLOBAL_DIR, PROJECTS_DIR, PROJECTS_SUBDIR, TICKET_RUNS } from '@choliba/core/config';

import { applyLocations, LocationsError, resolveLocations, resolveProjectsDir } from '../index';

function makeTmpDir(prefix: string): { path: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(join(os.tmpdir(), `${prefix}-`));
  return {
    path: dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

describe('resolveProjectsDir', () => {
  it('defaults to {GLOBAL_DIR}/projects', () => {
    expect(resolveProjectsDir('/tmp/global')).toBe(join('/tmp/global', PROJECTS_SUBDIR));
  });

  it('honors an explicit override', () => {
    expect(resolveProjectsDir('/tmp/global', '/custom/projects')).toBe('/custom/projects');
  });
});

describe('resolveLocations', () => {
  it('derives PROJECTS_DIR when only GLOBAL_DIR is set', () => {
    const tmp = makeTmpDir('playwright-config');
    try {
      const configPath = join(tmp.path, '.env');
      const readFile = (path: string): string | undefined =>
        path === configPath ? 'GLOBAL_DIR=/tmp/global\n' : undefined;

      expect(resolveLocations(tmp.path, {}, readFile)).toEqual({
        GLOBAL_DIR: '/tmp/global',
        PROJECTS_DIR: join('/tmp/global', PROJECTS_SUBDIR),
      });
    } finally {
      tmp.cleanup();
    }
  });

  it('accepts an explicit PROJECTS_DIR override', () => {
    const tmp = makeTmpDir('playwright-config-override');
    try {
      const configPath = join(tmp.path, '.env');
      const readFile = (path: string): string | undefined =>
        path === configPath ? 'GLOBAL_DIR=/tmp/global\nPROJECTS_DIR=/tmp/projetos\n' : undefined;

      expect(resolveLocations(tmp.path, {}, readFile)).toEqual({
        GLOBAL_DIR: '/tmp/global',
        PROJECTS_DIR: '/tmp/projetos',
      });
    } finally {
      tmp.cleanup();
    }
  });

  it('inclui TICKET_RUNS quando definido', () => {
    const tmp = makeTmpDir('playwright-config-ticket-runs');
    try {
      const configPath = join(tmp.path, '.env');
      const readFile = (path: string): string | undefined =>
        path === configPath ? 'GLOBAL_DIR=/tmp/global\nTICKET_RUNS=/tmp/runs\n' : undefined;

      expect(resolveLocations(tmp.path, {}, readFile)).toEqual({
        GLOBAL_DIR: '/tmp/global',
        PROJECTS_DIR: join('/tmp/global', PROJECTS_SUBDIR),
        TICKET_RUNS: '/tmp/runs',
      });
    } finally {
      tmp.cleanup();
    }
  });

  it('prefere process.env sobre .env', () => {
    const tmp = makeTmpDir('playwright-config-shell');
    try {
      const configPath = join(tmp.path, '.env');
      const readFile = (path: string): string | undefined =>
        path === configPath ? 'GLOBAL_DIR=/file\nPROJECTS_DIR=/file-projetos\n' : undefined;

      expect(resolveLocations(tmp.path, { GLOBAL_DIR: '/shell', PROJECTS_DIR: '/shell-projetos' }, readFile)).toEqual({
        GLOBAL_DIR: '/shell',
        PROJECTS_DIR: '/shell-projetos',
      });
    } finally {
      tmp.cleanup();
    }
  });

  it('erra quando GLOBAL_DIR falta', () => {
    expect(() => resolveLocations('/missing', {}, () => undefined)).toThrow(LocationsError);
  });

  it('erra quando GLOBAL_DIR está vazia', () => {
    expect(() => resolveLocations('/missing', { GLOBAL_DIR: '  ' }, () => undefined)).toThrow(LocationsError);
  });

  it('usa process.env por padrão como fonte de configuração', () => {
    const previous = process.env[GLOBAL_DIR];
    process.env[GLOBAL_DIR] = '/from-process-env';
    try {
      expect(resolveLocations('/missing', process.env, () => undefined).GLOBAL_DIR).toBe('/from-process-env');
    } finally {
      process.env[GLOBAL_DIR] = previous;
    }
  });

  it('defaults to process.env when processConfig is omitted', () => {
    const previous = process.env[GLOBAL_DIR];
    process.env[GLOBAL_DIR] = '/default-process-env';
    try {
      expect(resolveLocations('/missing', undefined, () => undefined).GLOBAL_DIR).toBe('/default-process-env');
    } finally {
      process.env[GLOBAL_DIR] = previous;
    }
  });
});

describe('applyLocations', () => {
  it('grava GLOBAL_DIR, PROJECTS_DIR e TICKET_RUNS em process.env', () => {
    const previousGlobal = process.env[GLOBAL_DIR];
    const previousProjetos = process.env[PROJECTS_DIR];
    const previousRuns = process.env[TICKET_RUNS];

    applyLocations({
      GLOBAL_DIR: '/global',
      PROJECTS_DIR: '/projetos',
      TICKET_RUNS: '/runs',
    });

    expect(process.env[GLOBAL_DIR]).toBe('/global');
    expect(process.env[PROJECTS_DIR]).toBe('/projetos');
    expect(process.env[TICKET_RUNS]).toBe('/runs');

    process.env[GLOBAL_DIR] = previousGlobal;
    process.env[PROJECTS_DIR] = previousProjetos;
    process.env[TICKET_RUNS] = previousRuns;
  });

  it('remove TICKET_RUNS de process.env quando ausente na config', () => {
    process.env[TICKET_RUNS] = '/old';
    applyLocations({
      GLOBAL_DIR: '/global',
      PROJECTS_DIR: '/projetos',
    });
    expect(process.env[TICKET_RUNS]).toBeUndefined();
  });
});
