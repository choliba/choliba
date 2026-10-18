import { existsSync } from 'node:fs';

import {
  assertProjectExists,
  findReadme,
  listProjectSpecs,
  loadProjectSettings,
  projectDir,
  projectTestsFolder,
  readmeSummary,
  readText,
  readTicket,
  readTickets,
  retiredCriteria,
  type ProjectsService,
} from '@choliba/projects';

import type { CholibaProject, CholibaProjectCounts, CholibaProjects } from './interfaces/choliba.interface';

/** The summary of the README at `appDir`'s root, or nothing: no folder, no README, or none to sum up. */
function appReadme(appDir: string): string | undefined {
  const file = existsSync(appDir) ? findReadme(appDir) : undefined;
  return file === undefined ? undefined : readmeSummary(readText(file));
}

/** How many tickets, criteria and criteria with a test the project has. */
function countsOf(projectsDir: string, name: string): CholibaProjectCounts {
  const tickets = readTickets(projectsDir, name);
  const criteria = tickets.flatMap((ticket) => ticket.criteria);
  return {
    tickets: tickets.length,
    criteria: criteria.length,
    criteriaWithTests: criteria.filter((criterion) => criterion.tests.length > 0).length,
  };
}

/** The project `name` of `projectsDir`, checked to exist; its settings, tickets and specs are read when asked. */
function cholibaProject(projectsDir: string, name: string): CholibaProject {
  assertProjectExists(projectsDir, name);
  return {
    name,
    dir: projectDir(projectsDir, name),
    get settings() {
      return loadProjectSettings(projectsDir, name);
    },
    get readme() {
      return appReadme(loadProjectSettings(projectsDir, name).appDir);
    },
    get counts() {
      return countsOf(projectsDir, name);
    },
    tickets: {
      list: () => readTickets(projectsDir, name),
      get: (id) => readTicket(projectsDir, name, id),
      retired: () => retiredCriteria(projectsDir, name),
    },
    tests: {
      dir: projectTestsFolder(projectsDir, name),
      list: () => listProjectSpecs(projectsDir, name),
    },
  };
}

/** The projects as the CLI's `service` sees them (`list projects`), each project got from its folder. */
export function cholibaProjects(service: () => ProjectsService): CholibaProjects {
  return {
    get dir() {
      return service().projectsDir();
    },
    list: () => service().list(),
    get: (name) => cholibaProject(service().projectsDir(), name),
  };
}
