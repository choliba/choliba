import { pathPatternError } from '@choliba/core';

import type { AgentStep } from '../../common';

import { parseMaxSize } from './step-size';

/** The list fields that hold path patterns, in the one format every search uses (`compilePathPatterns`). */
const PATTERN_FIELDS: readonly string[] = ['pattern', 'ignore'];

/** The named fields an action takes: the ones it needs, the ones it may have, and which of them are lists. */
export interface FieldSpec {
  readonly required: readonly string[];
  readonly optional: readonly string[];
  readonly lists: readonly string[];
  /** A rule across the fields (one of two ways to say a thing), once each field is right on its own. */
  readonly rule?: (step: AgentStep) => string | undefined;
}

/** Why the text field `name` is wrong: `max_size` is a size, `max_depth` a whole number from 1; any other text is fine. */
function textError(name: string, value: string): string | undefined {
  if (name === 'max_size' && Number.isNaN(parseMaxSize(value)))
    return `o campo "max_size" é um tamanho, como 40KB, 2MB ou 512`;
  if (name === 'max_depth' && !/^[1-9]\d*$/.test(value.trim()))
    return `o campo "max_depth" é um número inteiro, a partir de 1`;
  return undefined;
}

/** Why `value` is not a list of texts with at least one; nothing when it is. */
function listError(name: string, value: unknown): string | undefined {
  const isTexts = Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string');
  if (!isTexts) return `o campo "${name}" é uma lista de textos, com pelo menos um`;
  if (!PATTERN_FIELDS.includes(name)) return undefined;
  const error = value.map(pathPatternError).find((reason) => reason !== undefined);
  return error === undefined ? undefined : `o campo "${name}" tem um ${error}`;
}

/** Why `step` does not have the named fields `spec` asks for, or nothing when it does. */
export function fieldsError(step: AgentStep, spec: FieldSpec): string | undefined {
  const options = step.options;
  if (options === undefined) return 'escreva com campos nomeados, não como lista';
  const known = [...spec.required, ...spec.optional];
  const unknown = Object.keys(options).find((name) => !known.includes(name));
  if (unknown !== undefined) return `campo desconhecido "${unknown}" (esperado: ${known.join(', ')})`;
  const missing = spec.required.find((name) => options[name] === undefined);
  if (missing !== undefined) return `falta o campo "${missing}"`;
  for (const [name, value] of Object.entries(options)) {
    const error = spec.lists.includes(name)
      ? listError(name, value)
      : typeof value === 'string'
        ? textError(name, value)
        : `o campo "${name}" é um texto`;
    if (error !== undefined) return error;
  }
  return spec.rule?.(step);
}

/** The text field `name` of a checked step; empty when it is absent. */
export function textField(step: AgentStep, name: string): string {
  const value = step.options?.[name];
  return typeof value === 'string' ? value : '';
}

/** The list field `name` of a checked step; empty when it is absent. */
export function listField(step: AgentStep, name: string): readonly string[] {
  const value = step.options?.[name];
  return value === undefined || typeof value === 'string' ? [] : value;
}
