import path from 'node:path';

import {
  loadProjectSettings,
  selectEnvironment,
  type ProjectEnvironment,
  type ProjectSettingsConfig,
} from '@choliba/projects';

/** An item of `config.json#envs` (see `@choliba/projects`). */
export type ProjectEnvDef = ProjectEnvironment;

/** A project's `config.json`, validated. */
export type PlaywrightProjectConfig = ProjectSettingsConfig;

export { selectEnvironment };

/**
 * What a spec needs from its project: `BASE_URL` and `APP_DIR` of the active environment, its credentials
 * from `.env.json`, then `_global`. The project is read and checked by `loadProjectSettings`, which fails —
 * naming the file and the field — when a file is missing, the environment is invalid or a value is CHANGE_ME.
 */
export function loadProjectEnv(projectDir: string): Record<string, string> {
  return { ...loadProjectSettings(path.dirname(projectDir), path.basename(projectDir)).env };
}
