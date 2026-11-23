/**
 * The rounds of the project (`rounds.definitions`), fetched as
 * `definitions.json` from whoever serves the pages, once, the first time the
 * "Criar rodada" page asks. Without it (an old server, an error), no rounds:
 * the page only loses its "Abrir uma rodada do projeto" list.
 */

import { projectDefinitions, type ProjectDefinition } from './load-definition';

let request: Promise<readonly ProjectDefinition[]> | undefined;

/** The project's rounds, fetched on the first call and kept. */
export function fetchProjectDefinitions(): Promise<
  readonly ProjectDefinition[]
> {
  request ??= fetch('./definitions.json')
    .then((response) => (response.ok ? response.json() : []))
    .then((payload: unknown) => projectDefinitions(payload))
    .catch(() => []);
  return request;
}
