/**
 * The workspace root in `agent.yaml` (`${CHOL_ROOT}`): always found by choliba (the folder whose `package.json`
 * depends on it), never read from the `.env` or the environment.
 */
export const CHOL_ROOT = 'CHOL_ROOT';

/** The environment variable with the agents CLI's default provider. */
export const CHOL_AGENTS_PROVIDER = 'CHOL_AGENTS_PROVIDER';

/** The environment variable with the agents' folder. */
export const CHOL_AGENTS_DIR = 'CHOL_AGENTS_DIR';

/** The environment variable with the folder of the skills agents may use. */
export const CHOL_SKILLS_DIR = 'CHOL_SKILLS_DIR';

/** The environment variable with the folder of the MCP servers agents may use. */
export const CHOL_MCPS_DIR = 'CHOL_MCPS_DIR';

/** External workspace root (artifacts and, by default, projects under test). */
export const CHOL_GLOBAL_DIR = 'CHOL_GLOBAL_DIR';

/** Override for the projects folder when it is not `{CHOL_GLOBAL_DIR}/projects`. */
export const CHOL_PROJECTS_DIR = 'CHOL_PROJECTS_DIR';

/** Optional ticket-runs/ root when different from CHOL_PROJECTS_DIR. */
export const CHOL_TICKET_RUNS = 'CHOL_TICKET_RUNS';

/**
 * Where the `playwright-cli` run tool writes the files it names itself and where the `playwright-trace` one runs
 * (default `.cache/playwright-cli`).
 */
export const CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR = 'CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR';

/** The colors chosen for the workspace: `role.name=color`, separated by commas (`agents.test-writer=red`). */
export const CHOL_COLORS = 'CHOL_COLORS';
