import type { ConfigAddress, ConfigScalar, ConfigSource, ConfigValue } from '../../common';

/** What a key holds once converted: text, a number, true/false or a list. */
export type ConfigKind = 'string' | 'number' | 'boolean' | 'list';

/** The keys of a group already read, by name: what a default that depends on them gets. */
export type PreviousKeys = Readonly<Record<string, ConfigValue | undefined>>;

/** A key's default: a value, or one computed from the keys declared before it in the group. */
export type ConfigDefault = ConfigValue | ((previous: PreviousKeys) => ConfigValue | undefined);

/** How a group declares one key. */
export interface KeySpec {
  /** Its name in flat sources (the environment, a `.env`). */
  readonly env: string;
  /** Its path in nested sources (JSON, YAML); `[group, key]` when absent. */
  readonly path?: readonly string[];
  readonly type: ConfigKind;
  /** What it is for, in a few words. */
  readonly description: string;
  /** The only values it takes, when they are a closed list. */
  readonly values?: readonly string[];
  /** A credential: its value never shows in errors, listings or messages. */
  readonly secret?: boolean;
  readonly default?: ConfigDefault;
}

/** The keys of a group, by the name the code uses. */
export type KeySpecs = Readonly<Record<string, KeySpec>>;

type KindValue<S> = S extends { readonly values: readonly (infer Literal)[] }
  ? Literal
  : S extends { readonly type: 'number' }
    ? number
    : S extends { readonly type: 'boolean' }
      ? boolean
      : S extends { readonly type: 'list' }
        ? readonly ConfigScalar[]
        : string;

/** What a key gives: its type (its `values` as a union), or `undefined` too when it has no default. */
export type KeyValue<S extends KeySpec> = S extends { readonly default: ConfigDefault }
  ? KindValue<S>
  : KindValue<S> | undefined;

/** What a group gives: each key, read, converted and checked. */
export type GroupValue<K extends KeySpecs> = { readonly [Name in keyof K]: KeyValue<K[Name]> };

/** A key of a container, by identity: the same shape as the container's own tokens, so either takes the other. */
export interface ConfigToken<T> {
  readonly name: string;
  /** Never set: it only carries `T`. */
  readonly type?: T;
}

/** One key of a group, as a catalog lists it. */
export interface ConfigKey {
  readonly group: string;
  readonly name: string;
  readonly address: ConfigAddress;
  readonly type: ConfigKind;
  readonly description: string;
  readonly values?: readonly string[];
  readonly secret: boolean;
  readonly default?: ConfigDefault;
}

/** The keys a package declares, and how to read them. */
export interface ConfigGroup<T = unknown> {
  readonly name: string;
  readonly keys: readonly ConfigKey[];
  /** What the group gives in a container. */
  readonly token: ConfigToken<T>;
  /** What the group gives, from `sources` (the first one that sets a key wins), without a container. */
  read(sources: readonly ConfigSource[]): T;
}
