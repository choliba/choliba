/**
 * What a tool event may carry about the content the model handles: by default, nothing of it. The arguments that
 * hold a file's content (`content`, `old_string`, `new_string`) become their size, and the result only its size
 * (`bytes`). A provider with `toolOutput` hands them over whole, for whoever shows the tool to a person; the log
 * never keeps them (`redactToolDetail`).
 */

/** The arguments that carry a file's content. */
const CONTENT_KEYS = new Set(['content', 'old_string', 'new_string']);

/** `value` with every content argument (see `CONTENT_KEYS`) replaced by its size. */
export function redactToolValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactToolValue);
  if (typeof value !== 'object' || value === null) return value;
  const redacted: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    redacted[key] =
      CONTENT_KEYS.has(key) && typeof nested === 'string'
        ? { bytes: nested.length }
        : redactToolValue(nested);
  }
  return redacted;
}

/** A tool event's detail as the log keeps it: no content in the arguments and no result text. */
export function redactToolDetail(
  detail: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const { output: _output, ...rest } = detail;
  return {
    ...rest,
    ...('args' in rest ? { args: redactToolValue(rest['args']) } : {}),
  };
}
