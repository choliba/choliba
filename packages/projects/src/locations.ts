import path from 'node:path';

import { GLOBAL_DIR, PROJECTS_DIR, PROJECTS_SUBDIR, TICKET_RUNS, loadRepoConfig } from '@choliba/core/config';

/**
 * Where the projects under test live, resolved from the monorepo's `.env` (and the shell, which wins):
 * `GLOBAL_DIR`, `PROJECTS_DIR` (default `{GLOBAL_DIR}/projects`) and the optional `TICKET_RUNS`. Every other
 * project path (a project, its tickets, its reports) is derived from these by this package.
 */
export class LocationsError extends Error {}

export interface ProjectLocations {
  GLOBAL_DIR: string;
  PROJECTS_DIR: string;
  TICKET_RUNS?: string;
}

export function resolveProjectsDir(globalDir: string, projectsDirOverride?: string): string {
  const override = projectsDirOverride?.trim();
  if (override) return override;
  return path.join(globalDir, PROJECTS_SUBDIR);
}

function pickLocations(config: Readonly<Record<string, string | undefined>>): ProjectLocations {
  const globalDir = config[GLOBAL_DIR]?.trim();
  if (!globalDir) {
    throw new LocationsError(
      `${GLOBAL_DIR} não definida. Copie .env.example para .env na raiz do monorepo e preencha.`,
    );
  }

  const projectsDir = resolveProjectsDir(globalDir, config[PROJECTS_DIR]);
  const ticketRuns = config[TICKET_RUNS]?.trim();
  return {
    GLOBAL_DIR: globalDir,
    PROJECTS_DIR: projectsDir,
    ...(ticketRuns ? { TICKET_RUNS: ticketRuns } : {}),
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
  const globalDir = env[GLOBAL_DIR]?.trim();
  const projectsDir = env[PROJECTS_DIR]?.trim();
  if (!globalDir || !projectsDir) {
    throw new LocationsError(
      `${GLOBAL_DIR}/${PROJECTS_DIR} não definidas no ambiente — aplique as localizações (applyLocations) antes.`,
    );
  }
  const ticketRuns = env[TICKET_RUNS]?.trim();
  return { GLOBAL_DIR: globalDir, PROJECTS_DIR: projectsDir, ...(ticketRuns ? { TICKET_RUNS: ticketRuns } : {}) };
}

export function applyLocations(config: ProjectLocations): void {
  process.env[GLOBAL_DIR] = config.GLOBAL_DIR;
  process.env[PROJECTS_DIR] = config.PROJECTS_DIR;
  if (config.TICKET_RUNS) {
    process.env[TICKET_RUNS] = config.TICKET_RUNS;
  } else {
    Reflect.deleteProperty(process.env, TICKET_RUNS);
  }
}
