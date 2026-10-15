import { join } from 'node:path';

import { envSource, fileSource, type ConfigSource } from '@choliba/config';
import type { Platform } from '@choliba/core';

import { findWorkspaceRoot } from './workspace';
import { ENV_FILE } from './workspace-layout';

/** The workspace root when the command starts inside one, or nothing outside a workspace. */
export function workspaceRootOrNothing(platform: Platform): string | undefined {
  try {
    return findWorkspaceRoot(platform.cwd);
  } catch {
    return undefined;
  }
}

/** Process environment first, then the workspace's `.env` when one exists. */
export function workspaceConfigSources(platform: Platform): readonly ConfigSource[] {
  const root = workspaceRootOrNothing(platform);
  return root === undefined ? [envSource(platform.env)] : [envSource(platform.env), fileSource(join(root, ENV_FILE))];
}
