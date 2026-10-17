import fs from 'node:fs';

import { ProjectsError, readJsonFile } from '../common';
import { assertProjectExists, configJsonPath } from '../paths';

/** What the project's application is built with: `config.json#stack`, as the tech-stack-analyzer agent records it. */
export interface ProjectStack {
  /** The main language (`TypeScript`, `PHP`). */
  readonly language: string;
  readonly frameworks: readonly string[];
  /** The most important libraries. */
  readonly libraries: readonly string[];
  /** Other technologies and tools: database, ORM, Docker, build tools. */
  readonly tools: readonly string[];
}

/** The lists of `stack`, each optional (an empty list when absent). */
const STACK_LISTS = ['frameworks', 'libraries', 'tools'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** `value` as a stack, or why it is not one: `where` names it in the message (`config.stack`). */
export function parseProjectStack(value: unknown, where: string): ProjectStack {
  if (!isRecord(value)) throw new ProjectsError(`${where} precisa ser um objeto.`);
  const known = ['language', ...STACK_LISTS];
  const unknown = Object.keys(value).find((key) => !known.includes(key));
  if (unknown !== undefined) {
    throw new ProjectsError(`${where}.${unknown} não existe (esperado: ${known.join(', ')}).`);
  }
  const language = value['language'];
  if (!isText(language)) throw new ProjectsError(`${where}.language é obrigatório (texto não vazio).`);
  const list = (key: (typeof STACK_LISTS)[number]): readonly string[] => {
    const items: unknown = value[key] ?? [];
    if (Array.isArray(items) && items.every(isText)) return items;
    throw new ProjectsError(`${where}.${key} precisa ser uma lista de textos não vazios.`);
  };
  return { language, frameworks: list('frameworks'), libraries: list('libraries'), tools: list('tools') };
}

/** The keys of `config.json` a step may write, each with the rule its value must follow. */
const WRITABLE_KEYS: Readonly<Record<string, (value: unknown, where: string) => unknown>> = {
  stack: parseProjectStack,
};

/** The keys of `config.json` that `writeProjectConfigKey` writes. */
export const PROJECT_CONFIG_KEYS: readonly string[] = Object.keys(WRITABLE_KEYS);

/**
 * Sets `key` of `project`'s `config.json` to `value`, once `value` follows the key's rule; the other keys stay as
 * they are, in their order. A missing project, an unknown key, a value outside the rule or a file that is not a JSON
 * object throws `ProjectsError`, and the file is left untouched.
 */
export function writeProjectConfigKey(projectsDir: string, project: string, key: string, value: unknown): void {
  assertProjectExists(projectsDir, project);
  const file = configJsonPath(projectsDir, project);
  const parse = WRITABLE_KEYS[key];
  if (parse === undefined) {
    throw new ProjectsError(`config.${key} não pode ser gravado (aceitos: ${PROJECT_CONFIG_KEYS.join(', ')}).`);
  }
  const checked = parse(value, `config.${key}`);
  const config = readJsonFile(file);
  if (!isRecord(config)) throw new ProjectsError(`${file}: o conteúdo precisa ser um objeto JSON.`);
  fs.writeFileSync(file, `${JSON.stringify({ ...config, [key]: checked }, null, 2)}\n`);
}
