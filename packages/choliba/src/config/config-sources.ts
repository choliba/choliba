import { join } from 'node:path';

import { envSource, fileSource, type ConfigSource } from '@choliba/config';
import type { Platform } from '@choliba/kernel';

import { findWorkspaceRoot } from './workspace';
import { ENV_FILE } from '@choliba/workspace';

type Env = Readonly<Record<string, string | undefined>>;

/** The workspace root above `cwd`, or nothing outside a workspace. */
export function workspaceRootAt(cwd: string): string | undefined {
  try {
    return findWorkspaceRoot(cwd);
  } catch {
    return undefined;
  }
}

/** The workspace root when the command starts inside one, or nothing outside a workspace. */
export function workspaceRootOrNothing(platform: Platform): string | undefined {
  return workspaceRootAt(platform.cwd);
}

/** `env` first, then the `.env` of `root` when there is one. */
export function configSourcesAt(env: Env, root: string | undefined): readonly ConfigSource[] {
  return root === undefined ? [envSource(env)] : [envSource(env), fileSource(join(root, ENV_FILE))];
}

/** Process environment first, then the workspace's `.env` when one exists. */
export function workspaceConfigSources(platform: Platform): readonly ConfigSource[] {
  return configSourcesAt(platform.env, workspaceRootOrNothing(platform));
}
