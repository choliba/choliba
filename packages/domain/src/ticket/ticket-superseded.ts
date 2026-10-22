import { ExpectedError } from '@choliba/kernel';

import { fullTicket } from './ticket-name';

/** A criterion of one ticket that a later ticket replaces (`substitui`): its tests no longer run with the project. */
export interface RetiredCriterion {
  readonly ticket: string;
  readonly criterion: string;
  /** The ticket that replaces it. */
  readonly by: string;
  /** Its tests, as `criterios[].testes` names them: `<file>.spec.ts › <title>`. */
  readonly tests: readonly string[];
}

/** One criterion as substitution looks it up: its id and the tests it names. */
export interface TicketCriterionRef {
  readonly id: string;
  readonly tests: readonly string[];
}

/** `replaces` as a list of references, or why it is not one: `file` names it. */
export function parseReplaces(replaces: unknown, file: string): readonly string[] {
  if (!Array.isArray(replaces) || replaces.some((item) => typeof item !== 'string' || item === '')) {
    throw new ExpectedError(
      `${file}: substitui precisa ser uma lista de referências ("<ticket>" ou "<ticket>:<critério>").`,
    );
  }
  return replaces.filter((item): item is string => typeof item === 'string');
}

/** The criteria one reference (`<ticket>` or `<ticket>:<criterion>`) of `by` retires, or why it is invalid. */
export function retiredFromReference(
  reference: string,
  where: string,
  by: string,
  project: string,
  tickets: ReadonlyMap<string, readonly TicketCriterionRef[]>,
): readonly RetiredCriterion[] {
  const colon = reference.indexOf(':');
  const ticket = fullTicket(project, colon === -1 ? reference : reference.slice(0, colon));
  const criterion = colon === -1 ? undefined : reference.slice(colon + 1);
  const target = tickets.get(ticket);
  if (ticket === by) throw new ExpectedError(`${where}: um ticket não substitui a si mesmo.`);
  if (target === undefined) throw new ExpectedError(`${where}: o ticket ${ticket} não existe.`);
  const chosen = criterion === undefined ? target : target.filter(({ id }) => id === criterion);
  if (chosen.length === 0) throw new ExpectedError(`${where}: ${ticket} não tem o critério ${String(criterion)}.`);
  return chosen.map(({ id, tests }) => ({ ticket, criterion: id, by, tests }));
}

/** Tickets whose every criterion is in `retired`. */
export function fullyRetiredKeys(
  tickets: ReadonlyMap<string, readonly TicketCriterionRef[]>,
  retired: readonly RetiredCriterion[],
): ReadonlySet<string> {
  const isRetired = (ticket: string, criterion: string): boolean =>
    retired.some((item) => item.ticket === ticket && item.criterion === criterion);
  const names = [...tickets].filter(
    ([ticket, criteria]) => criteria.length > 0 && criteria.every(({ id }) => isRetired(ticket, id)),
  );
  return new Set(names.map(([ticket]) => ticket));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * What Playwright's `grepInvert` needs to leave the retired tests out of a run: one pattern per test, matching
 * its file inside the project's folder and its exact title (Playwright matches `<device> <file path> <title>`).
 */
export function retiredTestPatterns(project: string, retired: readonly RetiredCriterion[]): readonly RegExp[] {
  return retired.flatMap(({ tests }) =>
    tests.flatMap((test) => {
      const separator = test.indexOf(' › ');
      if (separator === -1) return [];
      const file = escapeRegExp(test.slice(0, separator));
      const title = escapeRegExp(test.slice(separator + ' › '.length).replaceAll(' › ', ' '));
      return [new RegExp(`(^| )${escapeRegExp(project)}/(.*/)?${file} ${title}( @|$)`)];
    }),
  );
}

/** The notice a run with retired criteria opens with: `aposentados: t-1 CA-01, CA-02 (substituídos por t-2)`. */
export function formatRetired(retired: readonly RetiredCriterion[]): string {
  const groups = new Map<string, { readonly ticket: string; readonly by: string; readonly criteria: string[] }>();
  for (const { ticket, criterion, by } of retired) {
    const key = `${ticket} ${by}`;
    const group = groups.get(key) ?? { ticket, by, criteria: [] };
    group.criteria.push(criterion);
    groups.set(key, group);
  }
  const parts = [...groups.values()].map(
    ({ ticket, by, criteria }) => `${ticket} ${criteria.join(', ')} (substituídos por ${by})`,
  );
  return `aposentados: ${parts.join('; ')}`;
}
