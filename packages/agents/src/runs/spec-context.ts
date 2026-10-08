// What `--help` and completion read from the workspace: the agents, projects, tickets and refs.

import { createSpawnGitRunner } from '@choliba/core';
import { listProjectNames, listTicketKeys } from '@choliba/projects';

import type { AgentsCliSpecContext } from '../agents/agents.help';
import type { AgentDefinition } from '../agents/interfaces/agent.interface';
import type { RunAgentsCliDeps } from './run-context';
import { projectsDir } from './run-context';

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
