/**
 * The names of the files choliba reads and writes, in one place: a name that has to change changes here, and every
 * package that uses it imports it from here.
 */

/** An agent's declaration, in `<agents folder>/<id>/`. */
export const AGENT_FILE = 'agent.yaml';

/** A skill's description, in `<skills folder>/<name>/`. */
export const SKILL_FILE = 'SKILL.md';

/** The workspace's configuration, at its root. */
export const ENV_FILE = '.env';

/** A package's manifest; the workspace's depends on choliba. */
export const PACKAGE_FILE = 'package.json';

/** A test project's configuration (environments, devices). */
export const PROJECT_CONFIG_FILE = 'config.json';

/** A test project's credentials, per environment. */
export const PROJECT_ENV_FILE = '.env.json';

/** The template of a test project's credentials, from which its `.env.json` is created. */
export const PROJECT_ENV_EXAMPLE_FILE = '.env.example.json';

/** The files `choliba setup` writes in a new workspace, besides the `.env`. */
export const ENV_EXAMPLE_FILE = '.env.example';
export const GITIGNORE_FILE = '.gitignore';
export const BUNFIG_FILE = 'bunfig.toml';
export const PRETTIERRC_FILE = '.prettierrc.json';
export const PRETTIERIGNORE_FILE = '.prettierignore';
export const ESLINT_CONFIG_FILE = 'eslint.config.mjs';
export const EDITORCONFIG_FILE = '.editorconfig';
