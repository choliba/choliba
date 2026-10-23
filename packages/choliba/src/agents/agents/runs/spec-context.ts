// What `--help` and completion read from the workspace: the agents, projects, tickets and refs.

import { createSpawnGitRunner } from '@choliba/kernel';
import { listProjectNames, listTicketKeys } from '@choliba/workspace';

import type { GitRunner } from '@choliba/kernel';
import type { AgentDefinition } from '../../common';
import type { RunAgentsCliDeps } from './run-context';
import { projectsDir } from './run-context';

/** The workspace data the app's agents command specs complete against. */
export interface AgentsCliSpecContext {
  /** The providers choliba found: `--provider`, `--<id>` and their completion. */
  readonly providers: RunAgentsCliDeps['providers'];
  readonly agents: readonly AgentDefinition[];
  readonly repoRoot: string;
  readonly git: GitRunner;
  /** The project names `--project` completes to, read when asked (none when the locations are not set). */
  readonly projects: () => readonly string[];
  /** The ticket keys `--ticket` completes to: of `project` when given, else of every project; read when asked. */
  readonly tickets: (project?: string) => readonly string[];
}

/** The projects `--project` completes to; none when the locations are not configured or the folder is missing. */
function projectNames(deps: RunAgentsCliDeps): readonly string[] {
  try {
    return listProjectNames(projectsDir(deps));
  } catch {
    return [];
  }
}

/**
 * The ticket keys `--ticket` completes to: those of `project` when one was typed (none when it is not a
 * project), else those of every project; none when the projects are not reachable.
 */
function ticketKeys(deps: RunAgentsCliDeps, project: string | undefined): readonly string[] {
  try {
    const dir = projectsDir(deps);
    const names = listProjectNames(dir);
    const projects = project === undefined ? names : names.filter((name) => name === project);
    return projects.flatMap((name) => listTicketKeys(dir, name));
  } catch {
    return [];
  }
}

export function specContext(agents: readonly AgentDefinition[], deps: RunAgentsCliDeps): AgentsCliSpecContext {
  return {
    agents,
    providers: deps.providers,
    repoRoot: deps.repoRoot,
    git: deps.git ?? createSpawnGitRunner(),
    projects: () => projectNames(deps),
    tickets: (project) => ticketKeys(deps, project),
  };
}
