import fs from 'node:fs';
import path from 'node:path';
import { ProjectsError } from './errors';
import { readJsonFile } from './json-file';
import type { ProjectLocations } from './locations';
import { assertProjectExists, projectDir } from './project';
import { REPORT_FOLDER, TEST_RESULTS_FOLDER } from './results';

/** The part of a ticket JSON this package reads: which spec tests cover each acceptance criterion. */
export interface TicketJson {
  criterios?: { testes?: string[] }[];
}

const TICKET_EXTENSION = '.json';

export function ticketSuffix(project: string, ticket: string): string {
  const prefix = `${project}-`;
  return ticket.startsWith(prefix) ? ticket.slice(prefix.length) : ticket;
}

export function fullTicket(project: string, ticketOrSuffix: string): string {
  const prefix = `${project}-`;
  return ticketOrSuffix.startsWith(prefix) ? ticketOrSuffix : `${prefix}${ticketOrSuffix}`;
}

export function parseTarget(target: string): { project: string; rawTicket: string } {
  const [project, rawTicket] = target.split(':');
  if (!project || !rawTicket) {
    throw new ProjectsError(`Alvo inválido: "${target}" — esperado "projeto:ticket".`);
  }
  return { project, rawTicket };
}

/** `{projeto}/tickets`, without checking that the project exists. */
export function ticketsFolderPath(projectsDir: string, project: string): string {
  return path.join(projectDir(projectsDir, project), 'tickets');
}

/** The file of the ticket whose suffix is `suffix` (`tickets/<suffix>.json`), exact case, not checked. */
export function ticketFilePath(projectsDir: string, project: string, suffix: string): string {
  return path.join(ticketsFolderPath(projectsDir, project), `${suffix}${TICKET_EXTENSION}`);
}

/** The suffix of each ticket in `ticketsDir` — one `<suffix>.json` file per ticket — sorted; none when it is missing. */
export function listTicketSuffixes(ticketsDir: string): string[] {
  if (!fs.existsSync(ticketsDir)) return [];
  return fs
    .readdirSync(ticketsDir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(TICKET_EXTENSION))
    .map((d) => d.name.slice(0, -TICKET_EXTENSION.length))
    .sort();
}

export function resolveTicketsFolder(projectsDir: string, project: string): string {
  assertProjectExists(projectsDir, project);
  return ticketsFolderPath(projectsDir, project);
}

export function listTickets(projectsDir: string, project: string): unknown[] {
  return listTicketSuffixes(resolveTicketsFolder(projectsDir, project)).map((suffix) =>
    readJsonFile(ticketFilePath(projectsDir, project, suffix)),
  );
}

export function listTicketKeys(projectsDir: string, project: string): string[] {
  return listTicketSuffixes(resolveTicketsFolder(projectsDir, project))
    .map((suffix) => fullTicket(project, suffix))
    .sort();
}

export function canonicalizeSuffix(projectsDir: string, project: string, suffix: string): string {
  const ticketsDir = resolveTicketsFolder(projectsDir, project);
  const suffixes = listTicketSuffixes(ticketsDir);
  if (suffixes.includes(suffix)) {
    return suffix;
  }

  const targetLower = suffix.toLowerCase();
  const found = suffixes.filter((name) => name.toLowerCase() === targetLower);
  if (found.length === 0) return suffix;
  if (found.length > 1) {
    throw new ProjectsError(
      `"${suffix}" casa com mais de um ticket em ${ticketsDir}, diferindo só na caixa (${found.join(', ')}) — resolva renomeando um deles.`,
    );
  }
  return found.join('');
}

export function canonicalTicket(projectsDir: string, project: string, ticketOrSuffix: string): string {
  const suffix = canonicalizeSuffix(projectsDir, project, ticketSuffix(project, ticketOrSuffix));
  return fullTicket(project, suffix);
}

export function ticketJsonPath(projectsDir: string, project: string, ticket: string): string {
  return ticketFilePath(projectsDir, project, canonicalizeSuffix(projectsDir, project, ticketSuffix(project, ticket)));
}

/** Root of `ticket-runs/`: `TICKET_RUNS` when set (and not blank), `PROJECTS_DIR` otherwise. */
export function resolveTicketRunsRoot(
  locations: Pick<ProjectLocations, 'PROJECTS_DIR'> & { readonly TICKET_RUNS?: string | undefined },
): string {
  const override = locations.TICKET_RUNS?.trim();
  return override === undefined || override === '' ? locations.PROJECTS_DIR : override;
}

export function resolveTicketRunsFolder(ticketRunsRoot: string, project: string, ticket?: string): string {
  const base = path.join(ticketRunsRoot, project, 'ticket-runs');
  return ticket ? path.join(base, ticket) : base;
}

export function resolveReportFolder(ticketRunsRoot: string, project: string, ticket?: string): string {
  return path.join(resolveTicketRunsFolder(ticketRunsRoot, project, ticket), REPORT_FOLDER);
}

export function resolveTestResultsFolder(ticketRunsRoot: string, project: string, ticket?: string): string {
  return path.join(resolveTicketRunsFolder(ticketRunsRoot, project, ticket), TEST_RESULTS_FOLDER);
}

export function ticketSpecFiles(ticketJson: TicketJson): string[] {
  const specs = new Set<string>();
  for (const criterio of ticketJson.criterios ?? []) {
    for (const testeTitle of criterio.testes ?? []) {
      const [arquivo] = testeTitle.split(' › ');
      if (arquivo) specs.add(arquivo.trim());
    }
  }
  return [...specs].sort();
}

export function resolveTicketSpecFiles(projectsDir: string, project: string, ticket: string): string[] {
  const jsonPath = ticketJsonPath(projectsDir, project, ticket);
  if (!fs.existsSync(jsonPath)) {
    throw new ProjectsError(`Ticket "${ticket}" não encontrado (${jsonPath} não existe).`);
  }
  return ticketSpecFiles(readJsonFile(jsonPath) as TicketJson);
}
