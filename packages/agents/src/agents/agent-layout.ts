import { join } from 'node:path';

/**
 * The names of the agents' folders and files, in one place. The paths are relative (to the root of the workspace or
 * of a `choliba add` source).
 */

/** What belongs to choliba in the workspace: agents, skills, MCPs and the theme. */
export const CHOLIBA_DIR = '.choliba';

/** The agents, in any root that has them (choliba's folder, a `choliba add` source). */
export const AGENTS_SUBDIR = 'agents';

/** The skills, next to the agents. */
export const SKILLS_SUBDIR = 'skills';

/** The MCP servers, next to the agents. */
export const MCPS_SUBDIR = 'mcps';

/** Where the agents live when `CHOL_AGENTS_DIR` says nothing else. */
export const DEFAULT_AGENTS_DIR = join(CHOLIBA_DIR, AGENTS_SUBDIR);

/** Where the skills live when `CHOL_SKILLS_DIR` says nothing else. */
export const DEFAULT_SKILLS_DIR = join(CHOLIBA_DIR, SKILLS_SUBDIR);

/** Where the MCP servers live when `CHOL_MCPS_DIR` says nothing else. */
export const DEFAULT_MCPS_DIR = join(CHOLIBA_DIR, MCPS_SUBDIR);

/** Files choliba generates and deletes, outside version control. */
export const CACHE_DIR = '.cache';

/** The empty folder of each agent run. */
export const RUNS_DIR = join(CACHE_DIR, 'runs');

/** An agent's declaration, in `<agents folder>/<id>/`. */
export const AGENT_FILE = 'agent.yaml';

/** A skill's description, in `<skills folder>/<name>/`. */
export const SKILL_FILE = 'SKILL.md';
