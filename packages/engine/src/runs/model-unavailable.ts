/**
 * What providers say when the model cannot take a request now, whoever runs it: out of capacity, overloaded, rate
 * limited, too many requests.
 */
const UNAVAILABLE = /\b(?:at capacity|overloaded|rate[ _-]?limit|too many requests|try a different model)/i;

/** Whether a run ended because its model could not take it now (`what` being what the run said last). */
export function modelUnavailable(what: string | undefined): boolean {
  return UNAVAILABLE.test(what ?? '');
}
