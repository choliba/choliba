import type { CommandSpec } from '@choliba/core';

import type { LocationsService } from '../locations';
import { listProjectNames, projectDir, REPORT_FOLDER } from '../paths';
import { listTicketKeys, projectTemplatesDir, resolveReportFolder } from '../tickets';
import type { NewProject } from './new-project';
import { createProject, readProjectConfig, type CreatedProject } from './project';
import { loadProjectSettings, type ProjectSettings } from './project-settings';
import { projectsCliSpec } from './projects-spec';

export interface ProjectSummary {
  readonly name: string;
  readonly description: string;
}

export interface ProjectTickets {
  readonly name: string;
  readonly tickets: readonly string[];
}

/** The test projects of the workspace: listing, checking and creating them. */
export class ProjectsService {
  constructor(private readonly locations: LocationsService) {}

  projectsDir(): string {
    return this.locations.projectsDir();
  }

  /** Each project with its `config.json#description` (empty when it has none or cannot be read). */
  list(): readonly ProjectSummary[] {
    const projectsDir = this.projectsDir();
    return listProjectNames(projectsDir).map((name) => ({ name, description: description(projectsDir, name) }));
  }

  listWithTickets(): readonly ProjectTickets[] {
    const projectsDir = this.projectsDir();
    return listProjectNames(projectsDir).map((name) => ({ name, tickets: listTicketKeys(projectsDir, name) }));
  }

  /** The settings a run of `project` would use; throws, naming what is still missing or CHANGE_ME. */
  check(project: string): ProjectSettings {
    return loadProjectSettings(this.projectsDir(), project);
  }

  /** `project` from the template, in the projects folder: where it went, and what its README gave. */
  create(project: NewProject): { readonly dir: string; readonly created: CreatedProject } {
    const projectsDir = this.projectsDir();
    const created = createProject(projectsDir, project.name, projectTemplatesDir(), {
      ...(project.appDir === undefined ? {} : { appDir: project.appDir }),
      ...(project.baseUrl === undefined ? {} : { baseUrl: project.baseUrl }),
    });
    return { dir: projectDir(projectsDir, project.name), created };
  }

  /** The report folder: the default name, or the one of a project (and ticket). */
  reportFolder(project: string | undefined, ticket: string | undefined): string {
    if (project === undefined) return REPORT_FOLDER;
    return resolveReportFolder(this.locations.ticketRunsRoot(), project, ticket);
  }

  /** `--help` and completion of `choliba projects`, read from disk on every call. */
  helpSpec(): CommandSpec {
    return projectsCliSpec(() => this.projectsDir());
  }
}

function description(projectsDir: string, project: string): string {
  try {
    const value = readProjectConfig(projectsDir, project)['description'];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
