import fs from 'node:fs';

import { ProjectsError, readJsonFile } from '../common';
import { assertProjectExists, configJsonPath } from '../paths';

/** One thing the application is built with: its name, the version its manifest declares and its page. */
export interface ProjectStackItem {
  /** `PHP`, `yiisoft/yii`, `Docker`. */
  readonly name: string;
  /** As the manifest declares it (`^8.3`), or `''` when none does. */
  readonly version: string;
  /** Its page, or `''` when none is known. */
  readonly url: string;
}

/** What the project's application is built with: `config.json#stack`, as the tech-stack-analyzer agent records it. */
export interface ProjectStack {
  /** The main language. */
  readonly language: ProjectStackItem;
  readonly frameworks: readonly ProjectStackItem[];
  /** The most important libraries. */
  readonly libraries: readonly ProjectStackItem[];
  /** Other technologies and tools: database, ORM, Docker, build tools. */
  readonly tools: readonly ProjectStackItem[];
}

/** The lists of `stack`, each optional (an empty list when absent). */
const STACK_LISTS = ['frameworks', 'libraries', 'tools'] as const;

/** The fields of an item: `name` required, the others optional (`''` when absent). */
const ITEM_FIELDS = ['name', 'version', 'url'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` as an item, its texts trimmed, or why it is not one: `where` names it (`config.stack.tools[2]`). */
function parseItem(value: unknown, where: string): ProjectStackItem {
  const expected = '{ name, version, url }';
  if (!isRecord(value)) throw new ProjectsError(`${where} precisa ser um objeto ${expected}.`);
  const unknown = Object.keys(value).find((key) => !(ITEM_FIELDS as readonly string[]).includes(key));
  if (unknown !== undefined) {
    throw new ProjectsError(`${where}.${unknown} não existe (esperado: ${ITEM_FIELDS.join(', ')}).`);
  }
  const text = (key: (typeof ITEM_FIELDS)[number]): string => {
    const field: unknown = value[key] ?? '';
    if (typeof field !== 'string') throw new ProjectsError(`${where}.${key} precisa ser um texto.`);
    return field.trim();
  };
  const name = text('name');
  if (name === '') throw new ProjectsError(`${where}.name é obrigatório (texto não vazio).`);
  return { name, version: text('version'), url: text('url') };
}

/** `value` as a stack, or why it is not one: `where` names it in the message (`config.stack`). */
export function parseProjectStack(value: unknown, where: string): ProjectStack {
  if (!isRecord(value)) throw new ProjectsError(`${where} precisa ser um objeto.`);
  const known = ['language', ...STACK_LISTS];
  const unknown = Object.keys(value).find((key) => !known.includes(key));
  if (unknown !== undefined) {
    throw new ProjectsError(`${where}.${unknown} não existe (esperado: ${known.join(', ')}).`);
  }
  if (value['language'] === undefined) throw new ProjectsError(`${where}.language é obrigatório.`);
  const list = (key: (typeof STACK_LISTS)[number]): readonly ProjectStackItem[] => {
    const items: unknown = value[key] ?? [];
    if (!Array.isArray(items)) throw new ProjectsError(`${where}.${key} precisa ser uma lista.`);
    return items.map((item: unknown, index) => parseItem(item, `${where}.${key}[${String(index)}]`));
  };
  return {
    language: parseItem(value['language'], `${where}.language`),
    frameworks: list('frameworks'),
    libraries: list('libraries'),
    tools: list('tools'),
  };
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
