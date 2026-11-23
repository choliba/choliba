/** Defaults of the project's configuration (`choliba.config.ts`). */

/** Where the logs go, relative to the project (option `logger.dir`). */
export const DEFAULT_LOG_DIR = '.choliba/logs';

/** Where the database lives, relative to the project (option `database.dir`). */
export const DEFAULT_DATABASE_DIR = '.choliba';

/** The database file's name (option `database.name`). */
export const DEFAULT_DATABASE_NAME = 'choliba.db';

/**
 * Where each workspace's home lives (option `workspaces.homes`): the home the CLIs
 * run with, instead of the user's (`~/.claude`, `~/.codex`, `~/.cursor`).
 * Next to the log and the database, and never visible in a sandbox.
 */
export const DEFAULT_HOMES_DIR = '.choliba/homes';

/**
 * The default root of the agents' workspaces (option `workspaces.dir`): the
 * folder an agent works in, and what `choliba clear --workspaces` empties.
 * A `Workspace` may still be given any other root.
 */
export const DEFAULT_WORKSPACES_DIR = '.choliba/workspaces';

/**
 * The words a boolean environment variable accepts (`env.boolean`), compared
 * in lower case: the usual spellings of yes and no in a .env.
 */
export const ENV_TRUE_WORDS: readonly string[] = ['1', 'true', 'yes', 'on'];
export const ENV_FALSE_WORDS: readonly string[] = ['0', 'false', 'no', 'off'];
