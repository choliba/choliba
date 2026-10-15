import { ConfigError, type ConfigSource } from '../common';
import type { ConfigCatalog } from './config-catalog';
import { configSettings, type ConfigSetting } from './config-settings';
import { convertKey } from './key-conversion';

/** Where a write went, and the key's value in effect after it, which an earlier read-only source may still win. */
export interface ConfigWrite {
  readonly source: string;
  readonly setting: ConfigSetting;
}

/**
 * Writes the key whose variable is `env` with `text`, converted and checked as the key says, into the first source that
 * writes; then reads the key again. An unknown key, a value that does not convert, or no source that writes is an error.
 */
export function writeConfig(
  catalog: ConfigCatalog,
  sources: readonly ConfigSource[],
  env: string,
  text: string,
): ConfigWrite {
  const key = catalog.keys.find((each) => each.address.env === env);
  if (key === undefined) {
    const known = catalog.keys.map((each) => each.address.env).join(', ');
    throw new ConfigError(`Chave desconhecida: ${env}. As chaves são ${known}.`);
  }
  const value = convertKey(key, text, 'flat', 'valor dado');
  const target = sources.find((source) => source.write !== undefined);
  if (target?.write === undefined) {
    throw new ConfigError(`Nenhuma fonte grava ${env}: ${sources.map((source) => source.name).join(', ')}.`);
  }
  target.write(key.address, value);
  const setting = configSettings(catalog, sources).find((each) => each.key === key);
  if (setting === undefined) throw new ConfigError(`${env} não está mais no catálogo.`);
  return { source: target.name, setting };
}
