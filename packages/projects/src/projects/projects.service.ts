import { Inject, Injectable } from '@nestjs/common';

import type { CommandSpec } from '@choliba/core';

import { LocationsService } from '../locations/nest';
import { listProjectNames, REPORT_FOLDER } from '../paths';
import { listTicketKeys, resolveReportFolder } from '../tickets';
import { readProjectConfig } from './project';
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
@Injectable()
export class ProjectsService {
  constructor(@Inject(LocationsService) private readonly locations: LocationsService) {}

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
