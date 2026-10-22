import path from 'node:path';

import { envSource, fileSource, type ConfigSource } from '@choliba/config';
import { projectLocations, projectsConfig, type ProjectLocations } from '@choliba/workspace';

/** The process environment first, then the workspace's `.env`. */
export function workspaceSources(
  root: string,
  env: Readonly<Record<string, string | undefined>>,
): readonly ConfigSource[] {
  return [envSource(env), fileSource(path.join(root, '.env'))];
}

/** The projects group's effective locations in a workspace. */
export function workspaceLocations(root: string, env: Readonly<Record<string, string | undefined>>): ProjectLocations {
  return projectLocations(projectsConfig.read(workspaceSources(root, env)));
}

/** The colors setting passed to the Playwright reporter process. */
export function workspaceColors(root: string, env: Readonly<Record<string, string | undefined>>): string | undefined {
  const address = { env: 'CHOL_COLORS', path: ['choliba', 'colors'] };
  for (const source of workspaceSources(root, env)) {
    const value = source.read(address);
    if (typeof value === 'string') return value;
  }
  return undefined;
}
