import type { ProjectSettings } from '@choliba/domain';

export interface ProjectSummary {
  readonly name: string;
  readonly description: string;
}

export interface ProjectTickets {
  readonly name: string;
  readonly tickets: readonly string[];
}

export interface ProjectPanelTicket {
  readonly id: string;
  readonly title?: string;
  readonly criteria: readonly {
    readonly id: string;
    readonly description: readonly string[];
    readonly tests: readonly string[];
  }[];
}

export interface CreatedProject {
  readonly readme?: string;
  readonly description?: string;
}

export interface ProjectsService {
  projectsDir(): string;
  list(): readonly ProjectSummary[];
  listWithTickets(): readonly ProjectTickets[];
  check(project: string): ProjectSettings;
  tickets(project: string): readonly ProjectPanelTicket[];
  ticketKeys(project: string): readonly string[];
  create(project: {
    readonly name: string;
    readonly appDir: string | undefined;
    readonly baseUrl: string | undefined;
  }): { readonly dir: string; readonly created: CreatedProject };
}
