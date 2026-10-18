import {
  assertProjectExists,
  listProjectSpecs,
  loadProjectSettings,
  projectDir,
  projectTestsFolder,
  readTicket,
  readTickets,
  type ProjectsService,
} from '@choliba/projects';

import type { CholibaProject, CholibaProjects } from './interfaces/choliba.interface';

/** The project `name` of `projectsDir`, checked to exist; its settings, tickets and specs are read when asked. */
function cholibaProject(projectsDir: string, name: string): CholibaProject {
  assertProjectExists(projectsDir, name);
  return {
    name,
    dir: projectDir(projectsDir, name),
    get settings() {
      return loadProjectSettings(projectsDir, name);
    },
    tickets: {
      list: () => readTickets(projectsDir, name),
      get: (id) => readTicket(projectsDir, name, id),
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
