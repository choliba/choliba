import type { AgentDefinition } from '@choliba/domain';
import type { RunProject } from '@choliba/engine';

export type { RunProject } from '@choliba/engine';
export { formatProject } from '@choliba/engine';

/** Where the application's installed dependencies live: no agent writes or deletes there. */
function dependenciesDir(project: RunProject): string {
  return `${project.appDir.replace(/\/+$/, '')}/node_modules/`;
}

/**
 * The agent with its project's installed dependencies (`<appDir>/node_modules/`) denied to write and delete,
 * whatever it declares, so the rule `formatProject` states is also enforced. Unchanged without a project.
 */
export function withProjectDenies(agent: AgentDefinition, project: RunProject | undefined): AgentDefinition {
  if (project === undefined) {
    return agent;
  }
  const { permissions } = agent;
  const denied = dependenciesDir(project);
  return {
    ...agent,
    permissions: {
      ...permissions,
      denyWrite: [...permissions.denyWrite, denied],
      denyDelete: [...permissions.denyDelete, denied],
    },
  };
}
