import { ConfigError } from '../common';
import type { ConfigGroup, ConfigKey } from './interfaces/group.interface';

/** The keys of every group of a program, which `configSettings` lists and `writeConfig` writes. */
export interface ConfigCatalog {
  readonly groups: readonly ConfigGroup[];
  readonly keys: readonly ConfigKey[];
}

function claim(owners: Map<string, ConfigKey>, place: string, what: string, key: ConfigKey): void {
  const owner = owners.get(place);
  if (owner !== undefined) {
    throw new ConfigError(`${what} ${place} está em ${owner.group}.${owner.name} e em ${key.group}.${key.name}.`);
  }
  owners.set(place, key);
}

/** The catalog of `groups`; two keys with one variable name or one path are an error that names both. */
export function configCatalog(groups: readonly ConfigGroup[]): ConfigCatalog {
  const keys = groups.flatMap((group) => group.keys);
  const byEnv = new Map<string, ConfigKey>();
  const byPath = new Map<string, ConfigKey>();
  for (const key of keys) {
    claim(byEnv, key.address.env, 'A variável', key);
    claim(byPath, key.address.path.join('.'), 'O caminho', key);
  }
  return { groups, keys };
}
