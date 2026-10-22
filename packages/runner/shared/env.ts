import path from 'node:path';

import { loadProjectSettings, selectEnvironment, type ProjectSettings } from '../src/app';
import type { ProjectEnvironment, ProjectSettingsConfig } from '@choliba/domain';

/** An item of `config.json#envs` (see `@choliba/domain`). */
export type ProjectEnvDef = ProjectEnvironment;

/** A project's `config.json`, validated. */
export type PlaywrightProjectConfig = ProjectSettingsConfig;

export { selectEnvironment };
export type { ProjectSettings };

/**
 * What a spec needs from its project: `BASE_URL` and `APP_DIR` of the active environment, its credentials
 * from `.env.json`, then `_global`. The project is read and checked by `loadProjectSettings`, which fails —
 * naming the file and the field — when a file is missing, the environment is invalid or a value is CHANGE_ME.
 */
export function loadProjectEnv(projectDir: string): Record<string, string> {
  return { ...loadProjectSettings(path.dirname(projectDir), path.basename(projectDir)).env };
}
