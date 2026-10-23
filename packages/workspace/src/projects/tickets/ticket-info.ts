import fs from 'node:fs';

import { ProjectsError, readJsonFile } from '../common';
import { canonicalTicket, listTicketKeys, ticketJsonPath, ticketSpecFiles } from './ticket';

/** One acceptance criterion of a ticket (`criterios[]`). */
export interface TicketCriterion {
  readonly id: string;
  /** `descricao`: its sentences, `Dado…`, `Quando…`, `Então…`. */
  readonly description: readonly string[];
  /** `testes`: the titles of the tests that cover it (`<file> › <test>`). */
  readonly tests: readonly string[];
}

/** A ticket as read from its `tickets/<suffix>.json`, typed. */
export interface TicketInfo {
  /** The full key, e.g. `app-1`. */
  readonly id: string;
  /** `tipo`, when the ticket says. */
  readonly type?: string;
  /** `titulo`, when the ticket says. */
  readonly title?: string;
  readonly criteria: readonly TicketCriterion[];
  /** The spec files its criteria's tests are in, sorted. */
  readonly specs: readonly string[];
  /** The ticket's JSON file. */
  readonly file: string;
  /** Every field of the JSON, for the ones this type does not name (`contexto`, `substitui`...). */
  readonly fields: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(json: Record<string, unknown>, key: string, file: string): string | undefined {
  const value = json[key];
  if (value === undefined || typeof value === 'string') return value;
  throw new ProjectsError(`${file}: "${key}" deve ser um texto.`);
}

function texts(value: unknown, where: string, file: string): readonly string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  throw new ProjectsError(`${file}: ${where} deve ser uma lista de textos.`);
}

function criterion(value: unknown, index: number, file: string): TicketCriterion {
  const where = `criterios[${String(index)}]`;
  if (!isRecord(value) || typeof value['id'] !== 'string') {
    throw new ProjectsError(`${file}: ${where} deve ser um objeto com "id" (texto).`);
  }
  return {
    id: value['id'],
    description: texts(value['descricao'], `${where}.descricao`, file),
    tests: texts(value['testes'], `${where}.testes`, file),
  };
}

function ticketInfo(id: string, file: string): TicketInfo {
  const json = readJsonFile(file);
  if (!isRecord(json)) throw new ProjectsError(`${file}: o ticket deve ser um objeto JSON.`);
  const criteria = json['criterios'] ?? [];
  if (!Array.isArray(criteria)) throw new ProjectsError(`${file}: "criterios" deve ser uma lista.`);
  const type = optionalText(json, 'tipo', file);
  const title = optionalText(json, 'titulo', file);
  const read = criteria.map((item: unknown, index) => criterion(item, index, file));
  return {
    id,
    ...(type === undefined ? {} : { type }),
    ...(title === undefined ? {} : { title }),
    criteria: read,
    specs: ticketSpecFiles({ criterios: read.map((each) => ({ testes: [...each.tests] })) }),
    file,
    fields: json,
  };
}

/** The ticket `ticketOrSuffix` of `project` (`app-1` or `1`), typed; a missing one names the file it looked for. */
export function readTicket(projectsDir: string, project: string, ticketOrSuffix: string): TicketInfo {
  const id = canonicalTicket(projectsDir, project, ticketOrSuffix);
  const file = ticketJsonPath(projectsDir, project, id);
  if (!fs.existsSync(file)) throw new ProjectsError(`Ticket "${id}" não encontrado (${file} não existe).`);
  return ticketInfo(id, file);
}

/** Every ticket of `project`, typed, sorted by key. */
export function readTickets(projectsDir: string, project: string): readonly TicketInfo[] {
  return listTicketKeys(projectsDir, project).map((id) => readTicket(projectsDir, project, id));
}
