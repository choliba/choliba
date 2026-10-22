import { ExpectedError } from '@choliba/kernel';

import { isRecord, PLACEHOLDER_VALUE } from '../common';
import { parseProjectStack, type ProjectStack } from './project-stack';

/** Reserved key of `.env.json`, merged into every environment; never an environment name. */
export const GLOBAL_ENV_KEY = '_global';

/** One item of `config.json#envs`: where an environment's application runs and where its code lives. */
export interface ProjectEnvironment {
  readonly nome: string;
  readonly baseURL: string;
  /** The application's source code for this environment, absolute or relative to the project folder. */
  readonly appDir: string;
  readonly default?: boolean;
  readonly resultsDir?: string;
  /** Commands run in `appDir`, in order, before every test run (`bun install`); one that fails stops the run. */
  readonly setup?: readonly string[];
  /** The command that starts the application, run in `appDir` when `baseURL` does not answer. */
  readonly start?: string;
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
  /** What the application is built with, as the tech-stack-analyzer agent records it; optional. */
  readonly stack?: ProjectStack;
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

function fail(file: string, reason: string): never {
  throw new ExpectedError(`${file}: ${reason}`);
}

function stringField(item: Record<string, unknown>, key: string, file: string, where: string): string {
  const value = item[key];
  return typeof value === 'string' && value.trim() !== ''
    ? value
    : fail(file, `${where}.${key} é obrigatório (texto não vazio).`);
}

function isCommand(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** `setup`: absent, or a list of commands. */
function setupField(item: Record<string, unknown>, file: string, where: string): { setup?: readonly string[] } {
  const setup = item['setup'];
  if (setup === undefined) return {};
  if (Array.isArray(setup) && setup.every(isCommand)) return { setup };
  return fail(file, `${where}.setup precisa ser uma lista de comandos (textos não vazios).`);
}

/** `start`: absent, or one command. */
function startField(item: Record<string, unknown>, file: string, where: string): { start?: string } {
  const start = item['start'];
  if (start === undefined) return {};
  return isCommand(start) ? { start } : fail(file, `${where}.start precisa ser um comando (texto não vazio).`);
}

function parseEnvironment(value: unknown, index: number, file: string): ProjectEnvironment {
  const where = `envs[${String(index)}]`;
  if (!isRecord(value)) {
    return fail(file, `${where} precisa ser um objeto.`);
  }
  const nome = stringField(value, 'nome', file, where);
  if (nome === GLOBAL_ENV_KEY) {
    return fail(file, `"${GLOBAL_ENV_KEY}" é reservado e não pode ser nome de ambiente (${where}.nome).`);
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
    ...setupField(value, file, at),
    ...startField(value, file, at),
  };
}

/** `stack`, checked; a wrong one fails naming the file. */
function stackField(value: unknown, file: string): ProjectStack {
  try {
    return parseProjectStack(value, 'config.stack');
  } catch (error) {
    return fail(file, (error as Error).message);
  }
}

/** `raw` as `config.json`, or why it is not one: `file` names it in the message. */
export function parseProjectSettingsConfig(raw: Record<string, unknown>, file: string): ProjectSettingsConfig {
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
  const stack = raw['stack'];
  return {
    name,
    ...(description === undefined ? {} : { description }),
    envs: envs.map((item: unknown, index) => parseEnvironment(item, index, file)),
    ...(typeof environment === 'string' ? { environment } : {}),
    ...(isRecord(devices) ? { devices } : {}),
    ...(stack === undefined ? {} : { stack: stackField(stack, file) }),
  };
}

/** The active environment: `fixed` when given, else the one marked `default: true`, else the first. */
export function selectEnvironment(envs: readonly ProjectEnvironment[], fixed?: string): ProjectEnvironment | undefined {
  const name = fixed ?? envs.find((env) => env.default === true)?.nome ?? envs[0]?.nome;
  return envs.find((env) => env.nome === name);
}

/** `value` as a map of texts, or why it is not one: `file` and `key` name it. */
export function parseStringSection(value: unknown, file: string, key: string): Record<string, string> {
  if (!isRecord(value)) {
    return fail(file, `"${key}" precisa ser um objeto de textos.`);
  }
  const section: Record<string, string> = {};
  for (const [name, item] of Object.entries(value)) {
    section[name] = typeof item === 'string' ? item : fail(file, `${key}.${name} precisa ser texto.`);
  }
  return section;
}

/** Field paths whose value is still `CHANGE_ME`. */
export function placeholderFields(values: Readonly<Record<string, string>>, where: string): string[] {
  return Object.entries(values)
    .filter(([, value]) => value.trim() === PLACEHOLDER_VALUE)
    .map(([name]) => `${where}.${name}`);
}

/** Why `project` cannot run yet: its pending `CHANGE_ME` fields, or `undefined` when it is ready. */
export function unconfiguredProjectMessage(project: string, pending: readonly string[]): string | undefined {
  if (pending.length === 0) return undefined;
  return `Projeto "${project}" ainda não foi configurado — troque ${PLACEHOLDER_VALUE} em: ${pending.join(', ')}.`;
}

/** Missing-environment message for `config.environment` against `envs`. */
export function unknownEnvironmentMessage(environment: string, envs: readonly ProjectEnvironment[]): string {
  return `o ambiente "${environment}" não existe em envs (disponíveis: ${envs.map((env) => env.nome).join(', ')}).`;
}
