/**
 * The names of the projects' folders and files, in one place. The paths are relative (to the folder of the projects
 * or of a project).
 */

/** Default subdirectory of CHOL_GLOBAL_DIR where projects live. */
export const PROJECTS_SUBDIR = 'projects';

/** A project's tickets. */
export const TICKETS_SUBDIR = 'tickets';

/** A project's specs. */
export const TESTS_SUBDIR = 'tests';

/** The results of each ticket's runs, per project. */
export const TICKET_RUNS_SUBDIR = 'ticket-runs';

/** A test project's configuration (environments, devices). */
export const PROJECT_CONFIG_FILE = 'config.json';

/** A test project's credentials, per environment. */
export const PROJECT_ENV_FILE = '.env.json';

/** The template of a test project's credentials, from which its `.env.json` is created. */
export const PROJECT_ENV_EXAMPLE_FILE = '.env.example.json';
