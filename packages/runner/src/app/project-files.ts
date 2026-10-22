import fs from 'node:fs';
import path from 'node:path';

import { ExpectedError } from '@choliba/core';
import {
  GLOBAL_ENV_KEY,
  parseProjectSettingsConfig,
  parseStringSection,
  placeholderFields,
  PLACEHOLDER_VALUE,
  selectEnvironment,
  unconfiguredProjectMessage,
  unknownEnvironmentMessage,
  type ProjectSettings,
} from '@choliba/domain';
import { PROJECT_CONFIG_FILE, PROJECT_ENV_EXAMPLE_FILE, PROJECT_ENV_FILE, TESTS_SUBDIR } from '@choliba/workspace';

import { readJsonFile } from './json-file';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(file: string, reason: string): never {
  throw new ExpectedError(`${file}: ${reason}`);
}

function readRecord(file: string): Record<string, unknown> {
  const value = readJsonFile(file);
  return isRecord(value) ? value : fail(file, 'o conteúdo precisa ser um objeto JSON.');
}

export function projectDir(projectsDir: string, project: string): string {
  return path.join(projectsDir, project);
}

export function configJsonPath(projectsDir: string, project: string): string {
  return path.join(projectDir(projectsDir, project), PROJECT_CONFIG_FILE);
}

export function envJsonPath(projectsDir: string, project: string): string {
  return path.join(projectDir(projectsDir, project), PROJECT_ENV_FILE);
}

export function projectEnvExampleFile(projectPath: string): string {
  return path.join(projectPath, PROJECT_ENV_EXAMPLE_FILE);
}

export function projectTestsFolder(projectsDir: string, project: string): string {
  return path.join(projectDir(projectsDir, project), TESTS_SUBDIR);
}

/** A hook a project may ship at its root, run once before or after all tests. */
export type ProjectHook = 'global-setup' | 'global-teardown';

export function projectHookFile(projectsDir: string, project: string, hook: ProjectHook): string {
  return path.join(projectDir(projectsDir, project), `${hook}.ts`);
}

export function projectExists(projectsDir: string, project: string): boolean {
  return fs.existsSync(configJsonPath(projectsDir, project));
}

export function assertProjectExists(projectsDir: string, project: string): void {
  if (!projectExists(projectsDir, project)) {
    throw new ExpectedError(
      `Projeto "${project}" não encontrado (${configJsonPath(projectsDir, project)} não existe).`,
    );
  }
}

export function listProjectNames(projectsDir: string): string[] {
  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && projectExists(projectsDir, entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function projectOfArgument(
  projectsDir: string,
  projects: readonly string[],
  argument: string,
  cwd: string,
): string | undefined {
  const inside = path.relative(projectsDir, path.resolve(cwd, argument));
  if (inside !== '' && !inside.startsWith('..') && !path.isAbsolute(inside)) {
    const first = inside.split(path.sep)[0];
    return projects.find((name) => name === first);
  }
  if (path.isAbsolute(argument)) return undefined;
  const segments = argument.split(/[\\/]/);
  return projects.find((name) => segments.includes(name));
}

/**
 * Reads and checks a project before anything runs against it: both files exist, `config.json` has a `name`
 * and at least one valid environment (`nome`, `baseURL`, `appDir`), the active one exists in `.env.json`, and nothing the
 * run uses still holds `CHANGE_ME`. Any problem throws naming the file and the field.
 */
export function loadProjectSettings(projectsDir: string, project: string): ProjectSettings {
  assertProjectExists(projectsDir, project);
  const configFile = configJsonPath(projectsDir, project);
  const envFile = envJsonPath(projectsDir, project);

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
        ...Object.fromEntries((environment.setup ?? []).map((command, index) => [`setup[${String(index)}]`, command])),
      },
      `${configFile} envs[${environment.nome}]`,
    ),
    ...placeholderFields(credentials, `${envFile} ${environment.nome}`),
    ...placeholderFields(globals, `${envFile} ${GLOBAL_ENV_KEY}`),
  ];
  const unconfigured = unconfiguredProjectMessage(project, pending);
  if (unconfigured !== undefined) throw new ExpectedError(unconfigured);

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
}
