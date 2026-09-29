import { isAbsolute, join } from 'node:path';

import {
  CHOL_AGENTS_DIR,
  CHOL_MCPS_DIR,
  CHOL_SKILLS_DIR,
  DEFAULT_AGENTS_DIR,
  DEFAULT_MCPS_DIR,
  DEFAULT_SKILLS_DIR,
} from '@choliba/core/config';

type Config = Readonly<Record<string, string | undefined>>;

function toAbsolute(path: string, root: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

/** Where agents are: `explicit` (`--agents-dir`), else `CHOL_AGENTS_DIR`, else `app/agents` at the workspace root. */
export function resolveAgentsDir(explicit: string | undefined, config: Config, root: string): string {
  const dir = explicit ?? config[CHOL_AGENTS_DIR];
  return dir === undefined ? join(root, DEFAULT_AGENTS_DIR) : toAbsolute(dir, root);
}

/** Where `agent.yaml#skills` are looked up: `CHOL_SKILLS_DIR`, else `app/.agents/skills` at the workspace root. */
export function resolveSkillsDir(config: Config, root: string): string {
  const dir = config[CHOL_SKILLS_DIR];
  return dir === undefined ? join(root, DEFAULT_SKILLS_DIR) : toAbsolute(dir, root);
}

/** Where `agent.yaml#mcps` are looked up: `CHOL_MCPS_DIR`, else `app/.agents/mcps` at the workspace root. */
export function resolveMcpsDir(config: Config, root: string): string {
  const dir = config[CHOL_MCPS_DIR];
  return dir === undefined ? join(root, DEFAULT_MCPS_DIR) : toAbsolute(dir, root);
}

/** The config entries that have a value: what `${NAME}` in an MCP server's JSON may use. */
export function definedConfig(config: Config): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(config).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
