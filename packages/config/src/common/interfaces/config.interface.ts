/** A value a key holds once read: text, a number, a yes or no, or a list of those. */
export type ConfigScalar = string | number | boolean;
export type ConfigValue = ConfigScalar | readonly ConfigScalar[];

/** The content of a nested file: objects only at the nodes, values at the leaves. */
export interface ConfigTree {
  readonly [name: string]: ConfigTree | ConfigValue;
}

/** Where a key is found: by name in a flat source (the environment, a `.env`), by path in a nested one (JSON, YAML). */
export interface ConfigAddress {
  readonly env: string;
  readonly path: readonly string[];
}

/** How a source keeps its keys: one name per key (`flat`), or a tree walked by path (`nested`). */
export type ConfigLayout = 'flat' | 'nested';

/** Where values come from: the environment, a file. Its name is the origin shown to the person. */
export interface ConfigSource {
  readonly name: string;
  readonly layout: ConfigLayout;
  /**
   * The source may repeat what a later source defines: Bun loads the `.env` of the folder it starts in into the
   * environment. A value equal to a later source's is then that source's.
   */
  readonly echoesLaterSources?: boolean;
  /** The raw value at `address`, or `undefined` when the source does not define it. */
  read(address: ConfigAddress): unknown;
  /** Writes `value` at `address`, keeping the rest of the source; absent when the source is read only. */
  write?(address: ConfigAddress, value: ConfigValue): void;
}

/** A file format: how its text becomes a tree, and, when it can, how one key is written back into the text. */
export interface ConfigFormat {
  readonly name: string;
  /** The endings of the file names in this format (`.json`), or whole names (`.env`). */
  readonly extensions: readonly string[];
  readonly layout: ConfigLayout;
  /** The tree of `text`; `file` names it in errors. */
  readonly parse: (text: string, file: string) => ConfigTree;
  /** `text` with the key at `address` set to `value`, the rest kept; absent when the format is read only. */
  readonly write?: (text: string, address: ConfigAddress, value: ConfigValue) => string;
}
