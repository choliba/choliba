import path from 'node:path';

import fs from 'node:fs';

import {
  GLOBAL_ENV_KEY,
  parseProjectSettingsConfig,
  parseStringSection,
  placeholderFields,
  PLACEHOLDER_VALUE,
  selectEnvironment,
  unconfiguredProjectMessage,
  unknownEnvironmentMessage,
  type ProjectEnvironment,
  type ProjectSettings,
  type ProjectSettingsConfig,
} from '@choliba/domain';

import { ProjectsError, readJsonFile, wrapProjects } from './common';
import { assertProjectExists, configJsonPath, envJsonPath, projectDir, projectEnvExampleFile } from './paths';

export type { ProjectEnvironment, ProjectSettings, ProjectSettingsConfig };
export { selectEnvironment };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(file: string, reason: string): never {
  throw new ProjectsError(`${file}: ${reason}`);
}

function readRecord(file: string): Record<string, unknown> {
  const value = readJsonFile(file);
  return isRecord(value) ? value : fail(file, 'o conteúdo precisa ser um objeto JSON.');
}

/**
 * Reads and checks a project before anything runs against it: both files exist, `config.json` has a `name`
 * and at least one valid environment (`nome`, `baseURL`, `appDir`), the active one exists in `.env.json`, and nothing the
 * run uses still holds `CHANGE_ME`. Any problem throws `ProjectsError` naming the file and the field.
 */
export function loadProjectSettings(projectsDir: string, project: string): ProjectSettings {
  assertProjectExists(projectsDir, project);
  const configFile = configJsonPath(projectsDir, project);
  const envFile = envJsonPath(projectsDir, project);

  return wrapProjects(() => {
    const config = parseProjectSettingsConfig(readRecord(configFile), configFile);
    const environment = selectEnvironment(config.envs, config.environment);
    if (environment === undefined) {
      return fail(configFile, unknownEnvironmentMessage(String(config.environment), config.envs));
    }

    if (!fs.existsSync(envFile)) {
      return fail(
        envFile,
        `não existe — crie a partir de ${projectEnvExampleFile(projectDir(projectsDir, project))} e troque os ${PLACEHOLDER_VALUE}.`,
      );
    }
    const perEnvironment = readRecord(envFile);
    const section = perEnvironment[environment.nome];
    if (section === undefined) {
      return fail(envFile, `falta a seção do ambiente "${environment.nome}" (copie o formato de .env.example.json).`);
    }
    const credentials = parseStringSection(section, envFile, environment.nome);
    const rawGlobals = perEnvironment[GLOBAL_ENV_KEY];
    const globals = rawGlobals === undefined ? {} : parseStringSection(rawGlobals, envFile, GLOBAL_ENV_KEY);

    const pending = [
      ...placeholderFields({ name: config.name }, `${configFile} config`),
      ...placeholderFields(
        {
          baseURL: environment.baseURL,
          appDir: environment.appDir,
          ...(environment.start === undefined ? {} : { start: environment.start }),
          ...Object.fromEntries(
            (environment.setup ?? []).map((command, index) => [`setup[${String(index)}]`, command]),
          ),
        },
        `${configFile} envs[${environment.nome}]`,
      ),
      ...placeholderFields(credentials, `${envFile} ${environment.nome}`),
      ...placeholderFields(globals, `${envFile} ${GLOBAL_ENV_KEY}`),
    ];
    const unconfigured = unconfiguredProjectMessage(project, pending);
    if (unconfigured !== undefined) throw new ProjectsError(unconfigured);

    const projectPath = projectDir(projectsDir, project);
    const appDir = path.resolve(projectPath, environment.appDir);
    return {
      project,
      projectPath,
      config,
      environment,
      appDir,
      credentials,
      globals,
      env: { BASE_URL: environment.baseURL, APP_DIR: appDir, ...credentials, ...globals },
    };
  });
}
