/**
 * Reading the environment in a config file (choliba.config.ts and what it
 * imports): each variable as a string, number, boolean or list. A variable
 * that is unset, or set to an empty string (`NAME=` in the .env), counts as
 * absent: the reader returns `undefined`, the `default`, or, when `required`,
 * refuses with a `UsageError` that says what to set.
 */

import { UsageError } from '../errors';
import { environment } from '../execute/process';
import { ENV_FALSE_WORDS, ENV_TRUE_WORDS } from './constants';

/** How a variable is read: optional, with a default, or required. */
export interface EnvOptions<T> {
  /** The value when the variable is absent. */
  readonly default?: T;
  /** Refuse when absent (and there is no `default`). */
  readonly required?: boolean;
}

type MustHave<T> = EnvOptions<T> &
  ({ readonly default: T } | { readonly required: true });

/** The variable's text, or `undefined` when unset or empty. */
function raw(name: string): string | undefined {
  const value = environment()[name];
  return value === undefined || value.trim() === '' ? undefined : value;
}

function absent<T>(
  name: string,
  kind: string,
  options: EnvOptions<T>,
): T | undefined {
  if (options.default !== undefined) return options.default;
  if (options.required === true) {
    throw new UsageError(
      `Defina a variável de ambiente ${name} (${kind}): no .env do projeto ou no ambiente de quem roda o Choliba.`,
    );
  }
  return undefined;
}

function read<T>(
  name: string,
  kind: string,
  options: EnvOptions<T>,
  parse: (value: string) => T,
): T | undefined {
  const value = raw(name);
  return value === undefined ? absent(name, kind, options) : parse(value);
}

function string(name: string, options: MustHave<string>): string;
function string(name: string, options?: EnvOptions<string>): string | undefined;
function string(
  name: string,
  options: EnvOptions<string> = {},
): string | undefined {
  return read(name, 'um texto', options, (value) => value);
}

function number(name: string, options: MustHave<number>): number;
function number(name: string, options?: EnvOptions<number>): number | undefined;
function number(
  name: string,
  options: EnvOptions<number> = {},
): number | undefined {
  return read(name, 'um número', options, (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      throw new UsageError(
        `A variável de ambiente ${name} deve ser um número; veio "${value}".`,
      );
    }
    return parsed;
  });
}

function boolean(name: string, options: MustHave<boolean>): boolean;
function boolean(
  name: string,
  options?: EnvOptions<boolean>,
): boolean | undefined;
function boolean(
  name: string,
  options: EnvOptions<boolean> = {},
): boolean | undefined {
  return read(name, 'sim ou não', options, (value) => {
    const word = value.trim().toLowerCase();
    if (ENV_TRUE_WORDS.includes(word)) return true;
    if (ENV_FALSE_WORDS.includes(word)) return false;
    throw new UsageError(
      `A variável de ambiente ${name} deve ser ${[...ENV_TRUE_WORDS, ...ENV_FALSE_WORDS].join(', ')}; veio "${value}".`,
    );
  });
}

function list(
  name: string,
  options: MustHave<readonly string[]>,
): readonly string[];
function list(
  name: string,
  options?: EnvOptions<readonly string[]>,
): readonly string[] | undefined;
function list(
  name: string,
  options: EnvOptions<readonly string[]> = {},
): readonly string[] | undefined {
  return read(name, 'uma lista separada por vírgulas', options, (value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  );
}

/**
 * The environment, read by kind: `env.string('NAME')`,
 * `env.boolean('NAME', { default: false })`,
 * `env.number('NAME', { required: true })`, `env.list('NAME')`.
 */
export const env = { string, number, boolean, list };
