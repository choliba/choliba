import { ProjectsError, readJsonFile } from '../common';
import { fullTicket, listTicketSuffixes, ticketFilePath, ticketsFolderPath } from './ticket';

/** A criterion of one ticket that a later ticket replaces (`substitui`): its tests no longer run with the project. */
export interface RetiredCriterion {
  readonly ticket: string;
  readonly criterion: string;
  /** The ticket that replaces it. */
  readonly by: string;
  /** Its tests, as `criterios[].testes` names them: `<file>.spec.ts › <title>`. */
  readonly tests: readonly string[];
}

interface Criterion {
  readonly id: string;
  readonly tests: readonly string[];
}

interface LoadedTicket {
  readonly file: string;
  readonly criteria: readonly Criterion[];
  readonly replaces: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function criteriaOf(json: unknown): readonly Criterion[] {
  const criteria: unknown = isRecord(json) ? json['criterios'] : undefined;
  return (Array.isArray(criteria) ? criteria : []).filter(isRecord).map((criterion) => ({
    id: typeof criterion['id'] === 'string' ? criterion['id'] : '',
    tests: strings(criterion['testes']),
  }));
}

/** Every ticket of the project, by its full name (`site-choliba-1`). */
function loadTickets(projectsDir: string, project: string): ReadonlyMap<string, LoadedTicket> {
  const tickets = new Map<string, LoadedTicket>();
  for (const suffix of listTicketSuffixes(ticketsFolderPath(projectsDir, project))) {
    const file = ticketFilePath(projectsDir, project, suffix);
    const json = readJsonFile(file);
    tickets.set(fullTicket(project, suffix), {
      file,
      criteria: criteriaOf(json),
      replaces: isRecord(json) ? json['substitui'] : undefined,
    });
  }
  return tickets;
}

/** The criteria one reference (`<ticket>` or `<ticket>:<criterion>`) of `by` retires, or why it is invalid. */
function referenced(
  reference: string,
  where: string,
  by: string,
  project: string,
  tickets: ReadonlyMap<string, LoadedTicket>,
): readonly RetiredCriterion[] {
  const colon = reference.indexOf(':');
  const ticket = fullTicket(project, colon === -1 ? reference : reference.slice(0, colon));
  const criterion = colon === -1 ? undefined : reference.slice(colon + 1);
  const target = tickets.get(ticket);
  if (ticket === by) throw new ProjectsError(`${where}: um ticket não substitui a si mesmo.`);
  if (target === undefined) throw new ProjectsError(`${where}: o ticket ${ticket} não existe.`);
  const chosen = criterion === undefined ? target.criteria : target.criteria.filter(({ id }) => id === criterion);
  if (chosen.length === 0) throw new ProjectsError(`${where}: ${ticket} não tem o critério ${String(criterion)}.`);
  return chosen.map(({ id, tests }) => ({ ticket, criterion: id, by, tests }));
}

/**
 * The criteria the tickets of `project` replace (`substitui`: `"<ticket>"` for all its criteria, or
 * `"<ticket>:<criterion>"`): their tests are retired from the project's runs. A reference to a ticket or
 * criterion that does not exist, or a ticket to itself, throws `ProjectsError` naming the file and the item.
 */
export function retiredCriteria(projectsDir: string, project: string): readonly RetiredCriterion[] {
  const tickets = loadTickets(projectsDir, project);
  return [...tickets].flatMap(([by, { file, replaces }]) => {
    if (replaces === undefined) return [];
    const references = Array.isArray(replaces) ? replaces : undefined;
    if (references === undefined || references.some((item) => typeof item !== 'string' || item === '')) {
      throw new ProjectsError(
        `${file}: substitui precisa ser uma lista de referências ("<ticket>" ou "<ticket>:<critério>").`,
      );
    }
    return (references as string[]).flatMap((reference, index) =>
      referenced(reference, `${file} substitui[${String(index)}]`, by, project, tickets),
    );
  });
}

/**
 * The tickets of `project` whose every criterion is retired: a batch of the project's tickets skips them, since
 * none of their tests would run.
 */
export function fullyRetiredTickets(projectsDir: string, project: string): ReadonlySet<string> {
  const retired = retiredCriteria(projectsDir, project);
  const isRetired = (ticket: string, criterion: string): boolean =>
    retired.some((item) => item.ticket === ticket && item.criterion === criterion);
  const tickets = [...loadTickets(projectsDir, project)].filter(
    ([ticket, { criteria }]) => criteria.length > 0 && criteria.every(({ id }) => isRetired(ticket, id)),
  );
  return new Set(tickets.map(([ticket]) => ticket));
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
