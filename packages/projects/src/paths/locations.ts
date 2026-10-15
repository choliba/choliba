import path from 'node:path';

import {
  CHOL_GLOBAL_DIR,
  CHOL_PROJECTS_DIR,
  CHOL_TICKET_RUNS,
  ExpectedError,
  PROJECTS_SUBDIR,
  loadRepoConfig,
} from '@choliba/core';

import type { projectsConfig } from './projects-config';

/**
 * Where the projects under test live, resolved from the monorepo's `.env` (and the shell, which wins):
 * `CHOL_GLOBAL_DIR`, `CHOL_PROJECTS_DIR` (default `{CHOL_GLOBAL_DIR}/projects`) and the optional `CHOL_TICKET_RUNS`. Every other
 * project path (a project, its tickets, its reports) is derived from these by this package.
 */

export class LocationsError extends ExpectedError {}

export interface ProjectLocations {
  CHOL_GLOBAL_DIR: string;
  CHOL_PROJECTS_DIR: string;
  CHOL_TICKET_RUNS?: string;
}

export function resolveProjectsDir(globalDir: string, projectsDirOverride?: string): string {
  const override = projectsDirOverride?.trim();
  if (override) return override;
  return path.join(globalDir, PROJECTS_SUBDIR);
}

/** The locations a read of `projectsConfig` names, trimmed the way the workspace has always stored them. */
export function projectLocations(config: ReturnType<typeof projectsConfig.read>): ProjectLocations {
  const globalDir = config.globalDir?.trim();
  if (globalDir === undefined || globalDir === '') {
    throw new LocationsError(
      `${CHOL_GLOBAL_DIR} não definida: defina no .env da pasta de trabalho (a que depende de choliba) ou no ambiente.`,
    );
  }
  const projectsDir = resolveProjectsDir(globalDir, config.projectsDir);
  const ticketRuns = config.ticketRuns?.trim();
  return {
    CHOL_GLOBAL_DIR: globalDir,
    CHOL_PROJECTS_DIR: projectsDir,
    ...(ticketRuns === undefined || ticketRuns === '' ? {} : { CHOL_TICKET_RUNS: ticketRuns }),
  };
}

function pickLocations(config: Readonly<Record<string, string | undefined>>): ProjectLocations {
  const globalDir = config[CHOL_GLOBAL_DIR]?.trim();
  if (!globalDir) {
    throw new LocationsError(
      `${CHOL_GLOBAL_DIR} não definida: defina no .env da pasta de trabalho (a que depende de choliba) ou no ambiente.`,
    );
  }

  const projectsDir = resolveProjectsDir(globalDir, config[CHOL_PROJECTS_DIR]);
  const ticketRuns = config[CHOL_TICKET_RUNS]?.trim();
  return {
    CHOL_GLOBAL_DIR: globalDir,
    CHOL_PROJECTS_DIR: projectsDir,
    ...(ticketRuns ? { CHOL_TICKET_RUNS: ticketRuns } : {}),
  };
}

export function resolveLocations(
  repoRoot: string,
  processConfig: Readonly<Record<string, string | undefined>> = process.env,
  readFile?: (path: string) => string | undefined,
): ProjectLocations {
  return pickLocations(loadRepoConfig(repoRoot, processConfig, readFile));
}

/**
 * The locations `applyLocations` left in `env` (by default `process.env`), for code that runs inside a
 * Playwright process started from this monorepo (global hooks, reporters). Fails when they were not applied.
 */
export function readAppliedLocations(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ProjectLocations {
  const globalDir = env[CHOL_GLOBAL_DIR]?.trim();
  const projectsDir = env[CHOL_PROJECTS_DIR]?.trim();
  if (!globalDir || !projectsDir) {
    throw new LocationsError(
      `${CHOL_GLOBAL_DIR}/${CHOL_PROJECTS_DIR} não definidas no ambiente — aplique as localizações (applyLocations) antes.`,
    );
  }
  const ticketRuns = env[CHOL_TICKET_RUNS]?.trim();
  return {
    CHOL_GLOBAL_DIR: globalDir,
    CHOL_PROJECTS_DIR: projectsDir,
    ...(ticketRuns ? { CHOL_TICKET_RUNS: ticketRuns } : {}),
  };
}

export function applyLocations(config: ProjectLocations): void {
  process.env[CHOL_GLOBAL_DIR] = config.CHOL_GLOBAL_DIR;
  process.env[CHOL_PROJECTS_DIR] = config.CHOL_PROJECTS_DIR;
  if (config.CHOL_TICKET_RUNS) {
    process.env[CHOL_TICKET_RUNS] = config.CHOL_TICKET_RUNS;
  } else {
    Reflect.deleteProperty(process.env, CHOL_TICKET_RUNS);
  }
}
