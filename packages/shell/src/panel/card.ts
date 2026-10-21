// What the cards of a panel's header share with whoever fills them.

/** A card line that is a rule across the card, in gray: what separates its parts. */
export const CARD_RULE = '---';

/** How long a card's work has run, as its state line says it: `0m41s`, `12m05s`. */
export function cardElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60))}m${String(seconds % 60).padStart(2, '0')}s`;
}
