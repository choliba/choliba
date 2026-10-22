import fs from 'node:fs';
import path from 'node:path';

import { ExpectedError } from '@choliba/core';
import {
  fullTicket,
  fullyRetiredKeys,
  parseReplaces,
  retiredFromReference,
  ticketSuffix,
  type RetiredCriterion,
  type TicketCriterionRef,
} from '@choliba/domain';
import { TICKETS_SUBDIR, TICKET_RUNS_SUBDIR, type ProjectLocations } from '@choliba/workspace';

import { readJsonFile } from './json-file';
import { assertProjectExists, projectDir } from './project-files';

const TICKET_EXTENSION = '.json';

export const TEST_RESULTS_FOLDER = 'test-results';
export const REPORT_FOLDER = 'playwright-report';

export interface ResultsRootSources {
  readonly runsFolder: string;
  readonly environmentResultsDir?: string | undefined;
  readonly globalResultsDir?: string | undefined;
}

function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

export function resolveResultsRoot(sources: ResultsRootSources): string {
  return present(sources.globalResultsDir) ?? present(sources.environmentResultsDir) ?? sources.runsFolder;
}

export function resolveResultsTestFolder(resultsRoot: string): string {
  return path.isAbsolute(resultsRoot)
    ? path.join(resultsRoot, TEST_RESULTS_FOLDER)
    : path.join(TEST_RESULTS_FOLDER, resultsRoot);
}

export function ticketsFolderPath(projectsDir: string, project: string): string {
  return path.join(projectDir(projectsDir, project), TICKETS_SUBDIR);
}

export function ticketFilePath(projectsDir: string, project: string, suffix: string): string {
  return path.join(ticketsFolderPath(projectsDir, project), `${suffix}${TICKET_EXTENSION}`);
}

export function listTicketSuffixes(ticketsDir: string): string[] {
  if (!fs.existsSync(ticketsDir)) return [];
  return fs
    .readdirSync(ticketsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(TICKET_EXTENSION))
    .map((entry) => entry.name.slice(0, -TICKET_EXTENSION.length))
    .sort();
}

export function resolveTicketsFolder(projectsDir: string, project: string): string {
  assertProjectExists(projectsDir, project);
  return ticketsFolderPath(projectsDir, project);
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
    throw new ExpectedError(
      `"${suffix}" casa com mais de um ticket em ${ticketsDir}, diferindo só na caixa (${found.join(', ')}) — resolva renomeando um deles.`,
    );
  }
  return found.join('');
}

export function ticketJsonPath(projectsDir: string, project: string, ticket: string): string {
  return ticketFilePath(projectsDir, project, canonicalizeSuffix(projectsDir, project, ticketSuffix(project, ticket)));
}

export function resolveTicketRunsRoot(
  locations: Pick<ProjectLocations, 'CHOL_PROJECTS_DIR'> & { readonly CHOL_TICKET_RUNS?: string | undefined },
): string {
  const override = locations.CHOL_TICKET_RUNS?.trim();
  return override === undefined || override === '' ? locations.CHOL_PROJECTS_DIR : override;
}

export function resolveTicketRunsFolder(ticketRunsRoot: string, project: string, ticket?: string): string {
  const base = path.join(ticketRunsRoot, project, TICKET_RUNS_SUBDIR);
  return ticket ? path.join(base, ticket) : base;
}

export function resolveReportFolder(ticketRunsRoot: string, project: string, ticket?: string): string {
  return path.join(resolveTicketRunsFolder(ticketRunsRoot, project, ticket), REPORT_FOLDER);
}

export function resolveTestResultsFolder(ticketRunsRoot: string, project: string, ticket?: string): string {
  return path.join(resolveTicketRunsFolder(ticketRunsRoot, project, ticket), TEST_RESULTS_FOLDER);
}

export interface TicketJson {
  criterios?: { testes?: string[] }[];
}

export function ticketSpecFiles(ticketJson: TicketJson): string[] {
  const specs = new Set<string>();
  for (const criterion of ticketJson.criterios ?? []) {
    for (const title of criterion.testes ?? []) {
      const [file] = title.split(' › ');
      if (file) specs.add(file.trim());
    }
  }
  return [...specs].sort();
}

export function resolveTicketSpecFiles(projectsDir: string, project: string, ticket: string): string[] {
  const jsonPath = ticketJsonPath(projectsDir, project, ticket);
  if (!fs.existsSync(jsonPath)) {
    throw new ExpectedError(`Ticket "${ticket}" não encontrado (${jsonPath} não existe).`);
  }
  return ticketSpecFiles(readJsonFile(jsonPath) as TicketJson);
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

interface LoadedTicket {
  readonly file: string;
  readonly criteria: readonly TicketCriterionRef[];
  readonly replaces: unknown;
}

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

export function retiredCriteria(projectsDir: string, project: string): readonly RetiredCriterion[] {
  const tickets = loadTickets(projectsDir, project);
  const lookup = criteriaMap(tickets);
  return [...tickets].flatMap(([by, { file, replaces }]) => {
    if (replaces === undefined) return [];
    return parseReplaces(replaces, file).flatMap((reference, index) =>
      retiredFromReference(reference, `${file} substitui[${String(index)}]`, by, project, lookup),
    );
  });
}

export function fullyRetiredTickets(projectsDir: string, project: string): ReadonlySet<string> {
  const tickets = loadTickets(projectsDir, project);
  return fullyRetiredKeys(criteriaMap(tickets), retiredCriteria(projectsDir, project));
}
