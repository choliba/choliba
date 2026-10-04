import path from 'node:path';

import { ProjectsError } from './errors';
import { readJsonFile } from './json-file';
import fs from 'node:fs';

import { assertProjectExists, configJsonPath, envJsonPath, projectDir, projectEnvExampleFile } from './project';

/** The value the template ships in every field someone must fill in; a project still holding one does not run. */
export const PLACEHOLDER_VALUE = 'CHANGE_ME';

/** Reserved key of `.env.json`, merged into every environment; never an environment name. */
const GLOBAL_KEY = '_global';

/** One item of `config.json#envs`: where an environment's application runs and where its code lives. */
export interface ProjectEnvironment {
  readonly nome: string;
  readonly baseURL: string;
  /** The application's source code for this environment, absolute or relative to the project folder. */
  readonly appDir: string;
  readonly default?: boolean;
  readonly resultsDir?: string;
}

/** `config.json`, validated. */
export interface ProjectSettingsConfig {
  /** How people call the project; required. */
  readonly name: string;
  /** What the project is, in a sentence or two; optional. */
  readonly description?: string;
  readonly envs: readonly ProjectEnvironment[];
  readonly environment?: string;
  /** Same format as a ticket's: a device is on unless it is `false`; absent means all on. */
  readonly devices?: Readonly<Record<string, unknown>>;
}

/** Everything a run needs to know about a project, read and checked once. */
export interface ProjectSettings {
  readonly project: string;
  /** `{CHOL_PROJECTS_DIR}/{projeto}`. */
  readonly projectPath: string;
  readonly config: ProjectSettingsConfig;
  /** The active environment: `config.environment`, else the one with `default: true`, else the first. */
  readonly environment: ProjectEnvironment;
  /** The active environment's `appDir`, absolute. */
  readonly appDir: string;
  /** The active environment's section of `.env.json`. */
  readonly credentials: Readonly<Record<string, string>>;
  /** `.env.json#_global`, merged into every environment. */
  readonly globals: Readonly<Record<string, string>>;
  /** What a spec sees: `BASE_URL`, `APP_DIR`, then the credentials, then `_global` (which wins). */
  readonly env: Readonly<Record<string, string>>;
}

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

function stringField(item: Record<string, unknown>, key: string, file: string, where: string): string {
  const value = item[key];
  return typeof value === 'string' && value.trim() !== ''
    ? value
    : fail(file, `${where}.${key} é obrigatório (texto não vazio).`);
}

function parseEnvironment(value: unknown, index: number, file: string): ProjectEnvironment {
  const where = `envs[${String(index)}]`;
  if (!isRecord(value)) {
    return fail(file, `${where} precisa ser um objeto.`);
  }
  const nome = stringField(value, 'nome', file, where);
  if (nome === GLOBAL_KEY) {
    return fail(file, `"${GLOBAL_KEY}" é reservado e não pode ser nome de ambiente (${where}.nome).`);
  }
  const at = `envs[${nome}]`;
  const defaultFlag = value['default'];
  const resultsDir = value['resultsDir'];
  return {
    nome,
    baseURL: stringField(value, 'baseURL', file, at),
    appDir: stringField(value, 'appDir', file, at),
    ...(defaultFlag === true ? { default: true } : {}),
    ...(typeof resultsDir === 'string' ? { resultsDir } : {}),
  };
}

function parseConfig(file: string): ProjectSettingsConfig {
  const raw = readRecord(file);
  const name = stringField(raw, 'name', file, 'config');
  const description = raw['description'];
  if (description !== undefined && typeof description !== 'string') {
    return fail(file, 'config.description precisa ser texto.');
  }
  const envs = raw['envs'];
  if (!Array.isArray(envs) || envs.length === 0) {
    return fail(file, 'nenhum ambiente definido (campo "envs" ausente ou vazio).');
  }
  const environment = raw['environment'];
  const devices = raw['devices'];
  return {
    name,
    ...(description === undefined ? {} : { description }),
    envs: envs.map((item: unknown, index) => parseEnvironment(item, index, file)),
    ...(typeof environment === 'string' ? { environment } : {}),
    ...(isRecord(devices) ? { devices } : {}),
  };
}

/** The active environment: `fixed` when given, else the one marked `default: true`, else the first. */
export function selectEnvironment(envs: readonly ProjectEnvironment[], fixed?: string): ProjectEnvironment | undefined {
  const name = fixed ?? envs.find((env) => env.default === true)?.nome ?? envs[0]?.nome;
  return envs.find((env) => env.nome === name);
}

function stringSection(value: unknown, file: string, key: string): Record<string, string> {
  if (!isRecord(value)) {
    return fail(file, `"${key}" precisa ser um objeto de textos.`);
  }
  const section: Record<string, string> = {};
  for (const [name, item] of Object.entries(value)) {
    section[name] = typeof item === 'string' ? item : fail(file, `${key}.${name} precisa ser texto.`);
  }
  return section;
}

function placeholders(values: Readonly<Record<string, string>>, where: string): string[] {
  return Object.entries(values)
    .filter(([, value]) => value.trim() === PLACEHOLDER_VALUE)
    .map(([name]) => `${where}.${name}`);
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

  const config = parseConfig(configFile);
  const environment = selectEnvironment(config.envs, config.environment);
  if (environment === undefined) {
    return fail(
      configFile,
      `o ambiente "${String(config.environment)}" não existe em envs (disponíveis: ${config.envs.map((env) => env.nome).join(', ')}).`,
    );
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
  const credentials = stringSection(section, envFile, environment.nome);
  const rawGlobals = perEnvironment[GLOBAL_KEY];
  const globals = rawGlobals === undefined ? {} : stringSection(rawGlobals, envFile, GLOBAL_KEY);

  const pending = [
    ...placeholders({ name: config.name }, `${configFile} config`),
    ...placeholders(
      { baseURL: environment.baseURL, appDir: environment.appDir },
      `${configFile} envs[${environment.nome}]`,
    ),
    ...placeholders(credentials, `${envFile} ${environment.nome}`),
    ...placeholders(globals, `${envFile} ${GLOBAL_KEY}`),
  ];
  if (pending.length > 0) {
    throw new ProjectsError(
      `Projeto "${project}" ainda não foi configurado — troque ${PLACEHOLDER_VALUE} em: ${pending.join(', ')}.`,
    );
  }

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
