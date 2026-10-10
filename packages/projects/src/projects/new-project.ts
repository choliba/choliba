import path from 'node:path';

import type { Ask } from '@choliba/core';

import { UsageError } from '../common';

/** What `projects new` was given, before the questions fill in what is missing. */
export interface NewProjectInput {
  readonly name: string | undefined;
  readonly appDir: string | undefined;
  readonly baseUrl: string | undefined;
  readonly noInput: boolean;
}

/** The project to create: its name, and the application folder (absolute) and base URL when known. */
export interface NewProject {
  readonly name: string;
  readonly appDir: string | undefined;
  readonly baseUrl: string | undefined;
}

const USAGE = 'Uso: choliba projects new [NOME] [--app-dir <pasta>] [--base-url <url>] [--no-input]';
const VALUE_FLAGS = ['--app-dir', '--base-url'] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

function isValueFlag(arg: string): arg is ValueFlag {
  return (VALUE_FLAGS as readonly string[]).includes(arg);
}

/** `projects new [NOME] [--app-dir DIR] [--base-url URL] [--no-input]`: every part optional, as typed. */
export function parseNewProjectArgs(args: readonly string[]): NewProjectInput {
  const names: string[] = [];
  const values: Partial<Record<ValueFlag, string>> = {};
  let noInput = false;
  const queue = [...args];
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    if (isValueFlag(arg)) {
      const value = queue.shift();
      if (value === undefined || value.startsWith('-')) throw new UsageError(`${arg} precisa de um valor. ${USAGE}`);
      values[arg] = value;
    } else if (arg === '--no-input') {
      noInput = true;
    } else if (arg.startsWith('-')) {
      throw new UsageError(`opção desconhecida: ${arg}. ${USAGE}`);
    } else {
      names.push(arg);
    }
  }
  if (names.length > 1) throw new UsageError(`crie um projeto só por vez (recebi ${names.join(', ')}). ${USAGE}`);
  return { name: names[0], appDir: values['--app-dir'], baseUrl: values['--base-url'], noInput };
}

/** A folder's name as a project name: lowercase, anything else than letters, digits, "-" and "_" as "-". */
export function projectNameOf(folder: string): string {
  return path
    .basename(folder)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function blankToUndefined(value: string): string | undefined {
  return value === '' ? undefined : value;
}

/** `answer` when typed, else `fallback`; what the question shows as its default. */
async function askWithDefault(ask: Ask, question: string, fallback: string | undefined): Promise<string | undefined> {
  const shown = fallback === undefined ? question : `${question} (${fallback})`;
  return blankToUndefined(await ask(`${shown}: `)) ?? fallback;
}

function checkName(name: string | undefined): string {
  if (name === undefined || name === '') {
    throw new UsageError(`falta o NOME do projeto (ou --app-dir, de cuja pasta ele sai). ${USAGE}`);
  }
  if (!NAME_PATTERN.test(name)) {
    throw new UsageError(`nome inválido "${name}": use letras minúsculas, dígitos, "-" e "_". ${USAGE}`);
  }
  return name;
}

/**
 * The project to create. On a terminal (`ask`), and without `--no-input`, it asks only for what is missing: the
 * application folder, the name (by default the folder's) and the base URL, a blank answer leaving the field to fill
 * in later. Without questions, the name is the folder's, and a missing name is an error naming NOME.
 */
export async function resolveNewProject(
  input: NewProjectInput,
  cwd: string,
  ask: Ask | undefined,
): Promise<NewProject> {
  const asking = input.noInput ? undefined : ask;
  let { appDir, baseUrl } = input;
  let name = input.name;
  if (asking !== undefined) {
    appDir ??= await askWithDefault(
      asking,
      'Pasta da aplicação, o código que os testes exercitam (vazio para preencher depois)',
      undefined,
    );
    name ??= await askWithDefault(asking, 'Nome do projeto', appDir === undefined ? undefined : projectNameOf(appDir));
    baseUrl ??= await askWithDefault(
      asking,
      'URL base da aplicação, como http://localhost:3000 (vazio para preencher depois)',
      undefined,
    );
  }
  name ??= appDir === undefined ? undefined : projectNameOf(appDir);
  return {
    name: checkName(name),
    appDir: appDir === undefined ? undefined : path.resolve(cwd, appDir),
    baseUrl,
  };
}
