import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

import {
  CHOL_AGENTS_DIR,
  CHOL_MCPS_DIR,
  CHOL_SKILLS_DIR,
  DEFAULT_AGENTS_DIR,
  DEFAULT_MCPS_DIR,
  DEFAULT_SKILLS_DIR,
} from '@choliba/core';

type Config = Readonly<Record<string, string | undefined>>;

function toAbsolute(path: string, root: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

/** This repository runs its own agents from here. An installed workspace has no such folder. */
const DOGFOOD_AGENTS_DIR = join('.agents', 'agents');

/** Skills those agents name, in the same `.agents/` tree. */
const DOGFOOD_SKILLS_DIR = join('.agents', 'skills');

function hasDogfoodAgents(root: string): boolean {
  return existsSync(join(root, DOGFOOD_AGENTS_DIR));
}

function configuredOrDefault(root: string, configured: string | undefined, dogfood: string, installed: string): string {
  if (configured !== undefined) return toAbsolute(configured, root);
  if (hasDogfoodAgents(root)) return join(root, dogfood);
  return join(root, installed);
}

/**
 * Where agents are: `explicit` (`--agents-dir`), else `CHOL_AGENTS_DIR`, else `.agents/agents` in this repo or
 * `.choliba/agents`.
 */
export function resolveAgentsDir(explicit: string | undefined, config: Config, root: string): string {
  return configuredOrDefault(root, explicit ?? config[CHOL_AGENTS_DIR], DOGFOOD_AGENTS_DIR, DEFAULT_AGENTS_DIR);
}

/**
 * Where `agent.yaml#skills` are looked up: `CHOL_SKILLS_DIR`, else `.agents/skills` in this repo or
 * `.choliba/skills`.
 */
export function resolveSkillsDir(config: Config, root: string): string {
  return configuredOrDefault(root, config[CHOL_SKILLS_DIR], DOGFOOD_SKILLS_DIR, DEFAULT_SKILLS_DIR);
}

/** Where `agent.yaml#mcps` are looked up: `CHOL_MCPS_DIR`, else `.choliba/mcps` at the workspace root. */
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
