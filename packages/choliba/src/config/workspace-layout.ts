import { join } from 'node:path';

import { CACHE_DIR } from '@choliba/agents';

/**
 * The names of the workspace's own folders and files, in one place: what `choliba setup` creates and what the app
 * reads at the workspace's root. The paths are relative to that root.
 */

/** Where the applications under test live (`app/<app>/`). */
export const APP_DIR = 'app';

/** The runs' artifacts (a new workspace's `CHOL_GLOBAL_DIR`). */
export const ARTIFACTS_DIR = join(CACHE_DIR, 'choliba');

/** The workspace's configuration. */
export const ENV_FILE = '.env';

/** The workspace's manifest, which depends on choliba. */
export const PACKAGE_FILE = 'package.json';

/** The files `choliba setup` writes in a new workspace, besides the `.env`. */
export const ENV_EXAMPLE_FILE = '.env.example';
export const GITIGNORE_FILE = '.gitignore';
export const BUNFIG_FILE = 'bunfig.toml';
export const PRETTIERRC_FILE = '.prettierrc.json';
export const PRETTIERIGNORE_FILE = '.prettierignore';
export const ESLINT_CONFIG_FILE = 'eslint.config.mjs';
export const EDITORCONFIG_FILE = '.editorconfig';
