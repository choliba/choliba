import { ConfigError, type ConfigScalar, type ConfigSource, type ConfigValue } from '../common';
import type { ConfigKey } from './interfaces/group.interface';

const NUMBER = /^-?\d+(\.\d+)?$/;

/** What a key expects, in words, for errors. */
const EXPECTED: Readonly<Record<ConfigKey['type'], string>> = {
  string: 'um texto',
  number: 'um número',
  boolean: 'true ou false',
  list: 'uma lista',
};

function isScalar(value: unknown): value is ConfigScalar {
  return (
    typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
  );
}

/** The value of a flat source's text: a number, true/false or a list split by commas, by the key's type. */
function fromText(key: ConfigKey, text: string): ConfigValue | undefined {
  if (key.type === 'string') return text;
  if (key.type === 'number') return NUMBER.test(text) ? Number(text) : undefined;
  if (key.type === 'boolean') return text === 'true' || text === 'false' ? text === 'true' : undefined;
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** A nested source's value, when it already has the key's type. */
function fromValue(key: ConfigKey, value: unknown): ConfigValue | undefined {
  if (key.type === 'list') return Array.isArray(value) && value.every(isScalar) ? value : undefined;
  if (!isScalar(value)) return undefined;
  const fits =
    (key.type === 'string' && typeof value === 'string') ||
    (key.type === 'number' && typeof value === 'number') ||
    (key.type === 'boolean' && typeof value === 'boolean');
  return fits ? value : undefined;
}

/** Whether `value` is one of the key's `values` (each item, for a list). */
function allowed(values: readonly string[], value: ConfigValue): boolean {
  const items: readonly ConfigScalar[] = Array.isArray(value) ? value : [value as ConfigScalar];
  return items.every((item) => values.includes(String(item)));
}

/** Why `raw` is not a value of `key`, said without the value when the key is a credential. */
function problem(key: ConfigKey, raw: unknown, wanted: string): string {
  const shown = key.secret ? '' : ` ("${String(raw)}")`;
  return `${key.address.env}: valor inválido${shown}; esperava ${wanted}.`;
}

/**
 * `raw` as a value of `key`: a flat source's text converted by the key's type, a nested source's value checked
 * against it, and either one checked against the key's `values`. `where` names the source in the error.
 */
export function convertKey(key: ConfigKey, raw: unknown, layout: ConfigSource['layout'], where: string): ConfigValue {
  const value = layout === 'flat' && typeof raw === 'string' ? fromText(key, raw) : fromValue(key, raw);
  if (value === undefined) throw new ConfigError(`${where}: ${problem(key, raw, EXPECTED[key.type])}`);
  if (key.values !== undefined && !allowed(key.values, value)) {
    throw new ConfigError(`${where}: ${problem(key, raw, `um de: ${key.values.join(', ')}`)}`);
  }
  return value;
}

/** A value as one line of text shows it: a list joined by commas. */
export function valueText(value: ConfigValue): string {
  return Array.isArray(value) ? value.join(',') : String(value);
}
