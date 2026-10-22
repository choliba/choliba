import { ExpectedError } from '@choliba/kernel';

import { isRecord } from '../common';

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

/** `value` as an item, its texts trimmed, or why it is not one: `where` names it (`config.stack.tools[2]`). */
function parseItem(value: unknown, where: string): ProjectStackItem {
  const expected = '{ name, version, url }';
  if (!isRecord(value)) throw new ExpectedError(`${where} precisa ser um objeto ${expected}.`);
  const unknown = Object.keys(value).find((key) => !(ITEM_FIELDS as readonly string[]).includes(key));
  if (unknown !== undefined) {
    throw new ExpectedError(`${where}.${unknown} não existe (esperado: ${ITEM_FIELDS.join(', ')}).`);
  }
  const text = (key: (typeof ITEM_FIELDS)[number]): string => {
    const field: unknown = value[key] ?? '';
    if (typeof field !== 'string') throw new ExpectedError(`${where}.${key} precisa ser um texto.`);
    return field.trim();
  };
  const name = text('name');
  if (name === '') throw new ExpectedError(`${where}.name é obrigatório (texto não vazio).`);
  return { name, version: text('version'), url: text('url') };
}

/** `value` as a stack, or why it is not one: `where` names it in the message (`config.stack`). */
export function parseProjectStack(value: unknown, where: string): ProjectStack {
  if (!isRecord(value)) throw new ExpectedError(`${where} precisa ser um objeto.`);
  const known = ['language', ...STACK_LISTS];
  const unknown = Object.keys(value).find((key) => !known.includes(key));
  if (unknown !== undefined) {
    throw new ExpectedError(`${where}.${unknown} não existe (esperado: ${known.join(', ')}).`);
  }
  if (value['language'] === undefined) throw new ExpectedError(`${where}.language é obrigatório.`);
  const list = (key: (typeof STACK_LISTS)[number]): readonly ProjectStackItem[] => {
    const items: unknown = value[key] ?? [];
    if (!Array.isArray(items)) throw new ExpectedError(`${where}.${key} precisa ser uma lista.`);
    return items.map((item: unknown, index) => parseItem(item, `${where}.${key}[${String(index)}]`));
  };
  return {
    language: parseItem(value['language'], `${where}.language`),
    frameworks: list('frameworks'),
    libraries: list('libraries'),
    tools: list('tools'),
  };
}
