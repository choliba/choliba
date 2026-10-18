import { existsSync } from 'node:fs';

import {
  assertProjectExists,
  findReadme,
  listProjectSpecs,
  loadProjectSettings,
  projectDir,
  projectTestsFolder,
  readmeSummary,
  resolveReportFolder,
  resolveTicketRunsRoot,
  readText,
  readTicket,
  readTickets,
  retiredCriteria,
  type ProjectsService,
} from '@choliba/projects';
import { ticketResults } from '@choliba/runner';

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
function cholibaProject(projectsDir: string, runsRoot: string, name: string): CholibaProject {
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
      results: (id) => {
        const ticket = readTicket(projectsDir, name, id);
        return ticketResults(resolveReportFolder(runsRoot, name, ticket.id), ticket.criteria);
      },
    },
    tests: {
      dir: projectTestsFolder(projectsDir, name),
      list: () => listProjectSpecs(projectsDir, name),
    },
  };
}

/** The projects as the CLI's `service` sees them (`list projects`), each project got from its folder. */
export function cholibaProjects(service: () => ProjectsService, ticketRuns: () => string | undefined): CholibaProjects {
  return {
    get dir() {
      return service().projectsDir();
    },
    list: () => service().list(),
    get: (name) => {
      const projectsDir = service().projectsDir();
      // Where `choliba run tests` leaves each ticket's report: CHOL_TICKET_RUNS, else the projects folder.
      const runsRoot = resolveTicketRunsRoot({ CHOL_PROJECTS_DIR: projectsDir, CHOL_TICKET_RUNS: ticketRuns() });
      return cholibaProject(projectsDir, runsRoot, name);
    },
  };
}
