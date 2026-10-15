import type { ConfigSource } from '../common';
import type { ConfigCatalog } from './config-catalog';
import type { ConfigKey } from './interfaces/group.interface';
import { readKeys, shownValue } from './key-reading';

/** One key with the value in effect, as a listing shows it. */
export interface ConfigSetting {
  readonly key: ConfigKey;
  /** The value as text; `undefined` when nothing sets it, and always for a credential. */
  readonly value: string | undefined;
  /** Whether something sets it: for a credential, all a listing says. */
  readonly isSet: boolean;
  /** The name of the source it came from, `padrão` or `nenhum`. */
  readonly origin: string;
  /** Why it could not be read, when a source has a wrong value. */
  readonly error?: string;
}

/** Every key of the catalog, in the order of its groups, with the value in effect in `sources` and where it is from. */
export function configSettings(catalog: ConfigCatalog, sources: readonly ConfigSource[]): readonly ConfigSetting[] {
  return catalog.groups.flatMap((group) =>
    readKeys(group.keys, sources).map((reading) => ({
      key: reading.key,
      value: shownValue(reading),
      isSet: reading.value !== undefined,
      origin: reading.origin,
      ...(reading.error === undefined ? {} : { error: reading.error }),
    })),
  );
}
