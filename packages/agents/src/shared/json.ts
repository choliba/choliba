/**
 * Narrowing helpers shared by the YAML loader and both provider stream parsers. None of
 * them cast: `JSON.parse`/`yaml.parse` return `unknown`, and every field pulled out of that
 * `unknown` is checked before use. This is what keeps `--strict` (`no-unsafe-assignment`,
 * `no-unsafe-member-access`) happy without a single `as`.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** A list of strings. A non-array, or an array with a non-string element, is rejected whole. */
export function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items: string[] = [];
  for (const item of value) {
    const itemAsString = asString(item);
    if (itemAsString === undefined) {
      return undefined;
    }
    items.push(itemAsString);
  }
  return items;
}

/** Parses a line of newline-delimited JSON. Returns `undefined` for blank or malformed input. */
export function parseJsonLine(line: string): unknown {
  const trimmed = line.trim();
  if (trimmed === '') {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}
