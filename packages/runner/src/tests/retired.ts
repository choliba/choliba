import { formatRetired, retiredCriteria, type RetiredCriterion } from '@choliba/projects';

import { fail } from './tests-error';

/** The project's retired criteria (`substitui`); an invalid reference stops the run, naming the file and item. */
export function retiredOf(projectsDir: string, project: string): readonly RetiredCriterion[] {
  try {
    return retiredCriteria(projectsDir, project);
  } catch (err) {
    return fail(`erro: ${(err as Error).message}`);
  }
}

/**
 * A run of one ticket whose criteria are retired: with `--expect` there is nothing to check (fails); without it,
 * runs them anyway, saying they were replaced. Nothing for a ticket that has none retired.
 */
export function guardRetiredTicket(
  ticket: string,
  retired: readonly RetiredCriterion[],
  gated: boolean,
  stderr: { write(chunk: string): unknown },
): void {
  const mine = retired.filter((item) => item.ticket === ticket);
  if (mine.length === 0) return;
  const what = formatRetired(mine).replace(/^aposentados: /, '');
  if (gated) fail(`erro: ${what}: não há o que conferir nele; confira o ticket que o substitui.`);
  stderr.write(`aviso: ${what}; rodando assim mesmo, só nesta execução.\n`);
}
