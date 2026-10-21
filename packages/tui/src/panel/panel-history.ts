/** How many of the messages sent the history keeps. */
const HISTORY_LIMIT = 100;

/** What was sent in the field, which ↑ and ↓ bring back, as a shell's history does. */
export interface FieldHistory {
  /** Keeps `text`, just sent (once, when it repeats the last one); the browsing starts over. */
  record(text: string): void;
  /**
   * What the field shows after ↑ (`-1`) or ↓ (`1`) while it shows `shown`: ↑ starts on an empty field, with the last
   * message, and goes back; ↓ comes forward, and past the last one empties the field. `undefined` when the key is not
   * the history's: the field has something typed, or there is nothing to bring.
   */
  step(shown: string, direction: -1 | 1): string | undefined;
}

export function fieldHistory(limit = HISTORY_LIMIT): FieldHistory {
  const entries: string[] = [];
  /** The entry the field shows while browsing. */
  let at: number | undefined;
  const start = (shown: string, direction: -1 | 1): string | undefined => {
    if (shown !== '' || direction === 1 || entries.length === 0) return undefined;
    at = entries.length - 1;
    return entries[at];
  };
  return {
    record: (text) => {
      at = undefined;
      if (entries.at(-1) === text) return;
      entries.push(text);
      if (entries.length > limit) entries.shift();
    },
    step: (shown, direction) => {
      // Editing what was brought back ends the browsing: the keys go back to the field.
      if (at === undefined || entries[at] !== shown) {
        at = undefined;
        return start(shown, direction);
      }
      const next = Math.max(0, at + direction);
      if (next >= entries.length) {
        at = undefined;
        return '';
      }
      at = next;
      return entries[at];
    },
  };
}
