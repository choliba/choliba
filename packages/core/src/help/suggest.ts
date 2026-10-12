/** The edits (insert, delete, replace) that turn `from` into `to`. */
function distance(from: string, to: string): number {
  let previous = Array.from({ length: to.length + 1 }, (_, index) => index);
  let last = to.length;
  for (const [row, letter] of Array.from(from).entries()) {
    let diagonal = row;
    let left = row + 1;
    const current = [left];
    for (const [column, above] of previous.slice(1).entries()) {
      left = Math.min(above + 1, left + 1, diagonal + (letter === to.charAt(column) ? 0 : 1));
      current.push(left);
      diagonal = above;
    }
    previous = current;
    last = left;
  }
  return last;
}

/**
 * The candidate `word` was most likely meant to be (`testdddd` → `tests`), or `undefined` when none is close: up to
 * half of the word's letters may differ, and never fewer than two. On a tie, the first candidate wins.
 */
export function closest(word: string, candidates: readonly string[]): string | undefined {
  const limit = Math.max(2, Math.floor(word.length / 2));
  let best: string | undefined;
  let bestDistance = limit + 1;
  for (const candidate of candidates) {
    const edits = distance(word, candidate);
    if (edits < bestDistance) {
      best = candidate;
      bestDistance = edits;
    }
  }
  return best;
}

/** `prefix` and, when a candidate is close, `Você quis dizer "x"?`: the first line of an unknown-word error. */
export function unknownWordMessage(prefix: string, word: string, candidates: readonly string[]): string {
  const guess = closest(word, candidates);
  return guess === undefined ? `${prefix}: ${word}.` : `${prefix}: ${word}. Você quis dizer "${guess}"?`;
}
