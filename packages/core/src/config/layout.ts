import { join } from 'node:path';

/**
 * The folders of the workspace and of a project, in one place. The paths are relative (to the root of the workspace,
 * of a project or of a `choliba install` source).
 */

/** Where the applications under test live (`app/<app>/`). */
export const APP_DIR = 'app';

/** What belongs to choliba in the workspace: agents, skills, MCPs and the theme. */
export const CHOLIBA_DIR = '.choliba';

/** The agents, in any root that has them (choliba's folder, a `choliba install` source). */
export const AGENTS_SUBDIR = 'agents';

/** The skills, next to the agents. */
export const SKILLS_SUBDIR = 'skills';

/** The MCP servers, next to the agents. */
export const MCPS_SUBDIR = 'mcps';

/** Default subdirectory of CHOL_GLOBAL_DIR where projects live. */
export const PROJECTS_SUBDIR = 'projects';

/** A project's tickets. */
export const TICKETS_SUBDIR = 'tickets';

/** A project's specs. */
export const TESTS_SUBDIR = 'tests';

/** The results of each ticket's runs, per project. */
export const TICKET_RUNS_SUBDIR = 'ticket-runs';

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

/** The runs' artifacts (a new workspace's `CHOL_GLOBAL_DIR`). */
export const ARTIFACTS_DIR = join(CACHE_DIR, 'choliba');
