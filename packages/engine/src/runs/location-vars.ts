import {
  agentTexts,
  CHOL_AGENTS_DIR,
  CHOL_GLOBAL_DIR,
  CHOL_MCPS_DIR,
  CHOL_PROJECTS_DIR,
  CHOL_ROOT,
  CHOL_SKILLS_DIR,
  CHOL_TICKET_RUNS,
  LOCATION_VARS,
  type AgentDefinition,
  withExpandedVars,
} from '@choliba/domain';
import { resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '@choliba/workspace';

import type { PrepareRunDeps } from './run-context';
import { errorMessage, locationsOf } from './run-context';

/** The variables that name the projects' locations, resolved only when the agent uses one. */
const LOCATION_VAR = new RegExp(`\\$\\{(${LOCATION_VARS.join('|')})\\}`);

/**
 * The folders an agent's `agent.yaml` may name, so it never depends on the workspace
 * layout, each under the same name as in `.env`: `${CHOL_ROOT}` (the workspace root, always found by the
 * application), `${CHOL_AGENTS_DIR}`, `${CHOL_SKILLS_DIR}` and `${CHOL_MCPS_DIR}` always;
 * `${CHOL_GLOBAL_DIR}`, `${CHOL_PROJECTS_DIR}` and `${CHOL_TICKET_RUNS}` once CHOL_GLOBAL_DIR is configured;
 * `${PROJECT}`/`${PROJECT_DIR}`/`${APP_DIR}` (the active environment's application code) when the run has
 * a project — all from `@choliba/projects` and `workspace-dirs`, this CLI works out no path itself.
 */
function locationVars(
  deps: PrepareRunDeps,
  projectVars: Readonly<Record<string, string>>,
  agent: AgentDefinition,
): Readonly<Record<string, string>> {
  // Resolved only when used: an agent naming none of them runs without CHOL_GLOBAL_DIR, and one that does
  // gets the clear "CHOL_GLOBAL_DIR não definida" instead of a missing variable.
  const locations = agentTexts(agent).some((text) => LOCATION_VAR.test(text)) ? locationsOf(deps.config) : undefined;
  return {
    [CHOL_ROOT]: deps.repoRoot,
    [CHOL_AGENTS_DIR]: resolveAgentsDir(undefined, deps.config, deps.repoRoot),
    [CHOL_SKILLS_DIR]: resolveSkillsDir(deps.config, deps.repoRoot),
    [CHOL_MCPS_DIR]: resolveMcpsDir(deps.config, deps.repoRoot),
    ...(locations === undefined
      ? {}
      : {
          [CHOL_GLOBAL_DIR]: locations.CHOL_GLOBAL_DIR,
          [CHOL_PROJECTS_DIR]: locations.CHOL_PROJECTS_DIR,
          ...(locations.CHOL_TICKET_RUNS === undefined ? {} : { [CHOL_TICKET_RUNS]: locations.CHOL_TICKET_RUNS }),
        }),
    ...projectVars,
  };
}

/** The agent with its `${…}` variables filled in; a missing one stops the run here, before any provider. */
export function expandAgent(
  agent: AgentDefinition,
  projectVars: Readonly<Record<string, string>>,
  deps: PrepareRunDeps,
): AgentDefinition | undefined {
  try {
    return withExpandedVars(agent, () => locationVars(deps, projectVars, agent));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}
