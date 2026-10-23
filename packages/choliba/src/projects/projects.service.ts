import { listProjectNames, projectDir } from '@choliba/workspace';
import { listTicketKeys, readTickets } from '@choliba/workspace';
import type { NewProject } from './new-project';
import { createProject, readProjectConfig, type CreatedProject } from '@choliba/workspace';
import { loadProjectSettings, type ProjectSettings } from '@choliba/workspace';
import type {
  ProjectPanelTicket,
  ProjectSummary,
  ProjectTickets,
  ProjectsService as ProjectsServiceContract,
} from '@choliba/tui';
import type { LocationsService } from './locations.service';
import { projectTemplatesDir } from './project-templates';
export type { ProjectTickets } from '@choliba/tui';

/** The test projects of the workspace: listing, checking and creating them. */
export class ProjectsService implements ProjectsServiceContract {
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

  tickets(project: string): readonly ProjectPanelTicket[] {
    return readTickets(this.projectsDir(), project);
  }

  ticketKeys(project: string): readonly string[] {
    return listTicketKeys(this.projectsDir(), project);
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
}

function description(projectsDir: string, project: string): string {
  try {
    const value = readProjectConfig(projectsDir, project)['description'];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
