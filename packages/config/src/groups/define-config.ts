import { ConfigError, type ConfigSource } from '../common';
import type { ConfigGroup, ConfigKey, GroupValue, KeySpec, KeySpecs } from './interfaces/group.interface';
import { convertKey } from './key-conversion';
import { readKeys } from './key-reading';

function keyOf(group: string, name: string, spec: KeySpec): ConfigKey {
  const key: ConfigKey = {
    group,
    name,
    address: { env: spec.env, path: spec.path ?? [group, name] },
    type: spec.type,
    description: spec.description,
    secret: spec.secret === true,
    ...(spec.values === undefined ? {} : { values: spec.values }),
    ...(spec.default === undefined ? {} : { default: spec.default }),
  };
  // A fixed default is checked now: a wrong one is the declaration's mistake, not the person's.
  if (key.default !== undefined && typeof key.default !== 'function') {
    convertKey(key, key.default, 'nested', `${group}.${name} (padrão)`);
  }
  return key;
}

/**
 * Declares the keys of a group: for each one, where it is found (`env` in flat sources, `path` in nested ones), its
 * type, what it is for, its default, the values it takes and whether it is a credential. The group gives an object with
 * every key read, converted and checked, by `token` in a container or by `read(sources)` without one.
 */
export function defineConfig<const K extends KeySpecs>(name: string, specs: K): ConfigGroup<GroupValue<K>> {
  const keys = Object.entries(specs).map(([key, spec]) => keyOf(name, key, spec));
  return {
    name,
    keys,
    token: { name: `config:${name}` },
    read: (sources: readonly ConfigSource[]) => {
      const readings = readKeys(keys, sources);
      const failed = readings.find((reading) => reading.error !== undefined);
      if (failed?.error !== undefined) throw new ConfigError(failed.error);
      return Object.fromEntries(readings.map((reading) => [reading.key.name, reading.value])) as GroupValue<K>;
    },
  };
}
