import { ConfigError, type ConfigSource, type ConfigValue } from '../common';
import type { ConfigKey, PreviousKeys } from './interfaces/group.interface';
import { convertKey, valueText } from './key-conversion';

/** Where a value in effect came from when no source set it. */
export const DEFAULT_ORIGIN = 'padrão';
export const NO_ORIGIN = 'nenhum';

/** One key of a group read from the sources: its value, where it came from, or why it could not be read. */
export interface KeyReading {
  readonly key: ConfigKey;
  readonly value: ConfigValue | undefined;
  readonly origin: string;
  readonly error?: string;
}

interface Found {
  readonly index: number;
  readonly raw: unknown;
  readonly source: ConfigSource;
}

function firstSetting(key: ConfigKey, sources: readonly ConfigSource[]): Found | undefined {
  for (const [index, source] of sources.entries()) {
    const raw = source.read(key.address);
    if (raw !== undefined) return { index, raw, source };
  }
  return undefined;
}

/** The name of the source a value is from: a later source with the same value, when the winner echoes later ones. */
function provenance(key: ConfigKey, sources: readonly ConfigSource[], found: Found): string {
  const winner = found.source;
  if (winner.echoesLaterSources !== true) return winner.name;
  const echoed = sources
    .slice(found.index + 1)
    .find((source) => String(source.read(key.address)) === String(found.raw));
  return (echoed ?? winner).name;
}

/** The keys read before `key`, where reading any other one is an error: a default depends only on earlier keys. */
function earlierKeys(key: ConfigKey, previous: Readonly<Record<string, ConfigValue | undefined>>): PreviousKeys {
  return new Proxy(previous, {
    get: (target, name) => {
      if (typeof name === 'string' && !(name in target)) {
        throw new ConfigError(`${key.group}.${key.name}: o padrão usa ${name}, que não vem antes no grupo.`);
      }
      return typeof name === 'string' ? target[name] : undefined;
    },
  });
}

function defaultOf(
  key: ConfigKey,
  previous: Readonly<Record<string, ConfigValue | undefined>>,
): ConfigValue | undefined {
  const declared = key.default;
  const value = typeof declared === 'function' ? declared(earlierKeys(key, previous)) : declared;
  return value === undefined ? undefined : convertKey(key, value, 'nested', `${key.group}.${key.name} (padrão)`);
}

function readOne(
  key: ConfigKey,
  sources: readonly ConfigSource[],
  previous: Readonly<Record<string, ConfigValue | undefined>>,
): Omit<KeyReading, 'key'> {
  const found = firstSetting(key, sources);
  if (found === undefined) {
    const value = defaultOf(key, previous);
    return { value, origin: value === undefined ? NO_ORIGIN : DEFAULT_ORIGIN };
  }
  const origin = provenance(key, sources, found);
  return { value: convertKey(key, found.raw, found.source.layout, origin), origin };
}

/**
 * The keys of a group, in their order, read from `sources` (the first that sets a key wins; then its default): each
 * with its value and origin, or the error that kept it from being read. A later key's default sees the earlier ones.
 */
export function readKeys(keys: readonly ConfigKey[], sources: readonly ConfigSource[]): readonly KeyReading[] {
  const previous: Record<string, ConfigValue | undefined> = {};
  return keys.map((key) => {
    try {
      const reading = { key, ...readOne(key, sources, previous) };
      previous[key.name] = reading.value;
      return reading;
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      previous[key.name] = undefined;
      return { key, value: undefined, origin: NO_ORIGIN, error: error.message };
    }
  });
}

/** A reading as one line shows it: the value, or nothing for a credential. */
export function shownValue(reading: KeyReading): string | undefined {
  if (reading.value === undefined || reading.key.secret) return undefined;
  return valueText(reading.value);
}
