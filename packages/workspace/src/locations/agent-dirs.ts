import { isAbsolute, join } from 'node:path';

import { DEFAULT_AGENTS_DIR, DEFAULT_MCPS_DIR, DEFAULT_SKILLS_DIR } from '../layout';

/** The variables that move the agents, the skills and the MCP servers out of `.choliba/`. */
export const CHOL_AGENTS_DIR = 'CHOL_AGENTS_DIR';
export const CHOL_SKILLS_DIR = 'CHOL_SKILLS_DIR';
export const CHOL_MCPS_DIR = 'CHOL_MCPS_DIR';

type Config = Readonly<Record<string, string | undefined>>;

function toAbsolute(path: string, root: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

function configuredOrDefault(root: string, configured: string | undefined, fallback: string): string {
  return configured === undefined ? join(root, fallback) : toAbsolute(configured, root);
}

/** Where agents are: `explicit` (`--agents-dir`), else `CHOL_AGENTS_DIR`, else `.choliba/agents`. */
export function resolveAgentsDir(explicit: string | undefined, config: Config, root: string): string {
  return configuredOrDefault(root, explicit ?? config[CHOL_AGENTS_DIR], DEFAULT_AGENTS_DIR);
}

/** Where `agent.yaml#skills` are looked up: `CHOL_SKILLS_DIR`, else `.choliba/skills`. */
export function resolveSkillsDir(config: Config, root: string): string {
  return configuredOrDefault(root, config[CHOL_SKILLS_DIR], DEFAULT_SKILLS_DIR);
}

/** Where `agent.yaml#mcps` are looked up: `CHOL_MCPS_DIR`, else `.choliba/mcps`. */
export function resolveMcpsDir(config: Config, root: string): string {
  return configuredOrDefault(root, config[CHOL_MCPS_DIR], DEFAULT_MCPS_DIR);
}
