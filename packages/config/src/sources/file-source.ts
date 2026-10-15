import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import type { ConfigAddress, ConfigFormat, ConfigSource, ConfigTree, ConfigValue } from '../common';
import { formatFor } from '../formats';

export interface FileSourceOptions {
  /** The file's format; by default, the one its name says (`.env`, `.json`, `.yaml`). */
  readonly format?: ConfigFormat;
  /** The origin shown to the person; by default, the file's name. */
  readonly name?: string;
}

function isNode(value: ConfigTree | ConfigValue): value is ConfigTree {
  return typeof value === 'object' && !Array.isArray(value);
}

/** What `tree` holds at `path`, or `undefined` when a step of the path is missing or is not a node. */
function walk(tree: ConfigTree, path: readonly string[]): unknown {
  let at: ConfigTree | ConfigValue = tree;
  for (const step of path) {
    const next: ConfigTree | ConfigValue | undefined = isNode(at) ? at[step] : undefined;
    if (next === undefined) return undefined;
    at = next;
  }
  return at;
}

/**
 * A file as a source, read once and again after each write. A file that does not exist is an empty source. It writes
 * when its format does (the `.env` does).
 */
export function fileSource(file = '.env', options: FileSourceOptions = {}): ConfigSource {
  const format = options.format ?? formatFor(file);
  let tree: ConfigTree | undefined;
  const exists = (): boolean => existsSync(file);
  const text = (): string => (exists() ? readFileSync(file, 'utf8') : '');
  const content = (): ConfigTree => (tree ??= exists() ? format.parse(text(), file) : {});
  const read = (address: ConfigAddress): unknown =>
    format.layout === 'flat' ? content()[address.env] : walk(content(), address.path);
  const writer = format.write;
  return {
    name: options.name ?? basename(file),
    layout: format.layout,
    read,
    ...(writer === undefined
      ? {}
      : {
          write: (address: ConfigAddress, value: ConfigValue) => {
            writeFileSync(file, writer(text(), address, value));
            tree = undefined;
          },
        }),
  };
}
