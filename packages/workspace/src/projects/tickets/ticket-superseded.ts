import {
  formatRetired,
  fullyRetiredKeys,
  parseReplaces,
  retiredFromReference,
  retiredTestPatterns,
  type RetiredCriterion,
  type TicketCriterionRef,
} from '@choliba/domain';

import { readJsonFile, wrapProjects } from '../common';
import { fullTicket, listTicketSuffixes, ticketFilePath, ticketsFolderPath } from './ticket';

export type { RetiredCriterion };
export { formatRetired, retiredTestPatterns };

interface LoadedTicket {
  readonly file: string;
  readonly criteria: readonly TicketCriterionRef[];
  readonly replaces: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function criteriaOf(json: unknown): readonly TicketCriterionRef[] {
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

function criteriaMap(tickets: ReadonlyMap<string, LoadedTicket>): ReadonlyMap<string, readonly TicketCriterionRef[]> {
  return new Map([...tickets].map(([name, loaded]) => [name, loaded.criteria]));
}

/**
 * The criteria the tickets of `project` replace (`substitui`: `"<ticket>"` for all its criteria, or
 * `"<ticket>:<criterion>"`): their tests are retired from the project's runs. A reference to a ticket or
 * criterion that does not exist, or a ticket to itself, throws `ProjectsError` naming the file and the item.
 */
export function retiredCriteria(projectsDir: string, project: string): readonly RetiredCriterion[] {
  const tickets = loadTickets(projectsDir, project);
  const lookup = criteriaMap(tickets);
  return wrapProjects(() =>
    [...tickets].flatMap(([by, { file, replaces }]) => {
      if (replaces === undefined) return [];
      return parseReplaces(replaces, file).flatMap((reference, index) =>
        retiredFromReference(reference, `${file} substitui[${String(index)}]`, by, project, lookup),
      );
    }),
  );
}

/**
 * The tickets of `project` whose every criterion is retired: a batch of the project's tickets skips them, since
 * none of their tests would run.
 */
export function fullyRetiredTickets(projectsDir: string, project: string): ReadonlySet<string> {
  const tickets = loadTickets(projectsDir, project);
  return fullyRetiredKeys(criteriaMap(tickets), retiredCriteria(projectsDir, project));
}
