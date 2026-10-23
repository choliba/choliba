import fs from 'node:fs';
import path from 'node:path';

import { parseTicketTemplate, placeholderPaths, unknownTicketTypeMessage, type TicketTemplate } from '@choliba/domain';

import { ProjectsError, readJsonFile, wrapProjects } from '../common';
import { fullTicket, listTicketSuffixes, resolveTicketsFolder, ticketFilePath } from './ticket';

export type { TicketTemplate };

const TEMPLATE_EXTENSION = '.json';

/** The ticket types there are templates for, sorted: the name of each `<type>.json`. */
export function listTicketTypes(templatesDir: string): string[] {
  if (!fs.existsSync(templatesDir)) return [];
  return fs
    .readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(TEMPLATE_EXTENSION))
    .map((entry) => entry.name.slice(0, -TEMPLATE_EXTENSION.length))
    .sort();
}

/** The suffix a new ticket of `project` gets: the highest numeric suffix plus one (`1` when there is none). */
export function nextTicketSuffix(projectsDir: string, project: string): string {
  const numbers = listTicketSuffixes(resolveTicketsFolder(projectsDir, project))
    .filter((suffix) => /^\d+$/.test(suffix))
    .map(Number);
  return String(Math.max(0, ...numbers) + 1);
}

export interface NewTicket {
  /** The full key, e.g. `red-4`. */
  readonly ticket: string;
  /** The ticket's `tickets/<N>.json`. */
  readonly path: string;
  /** The exact text written, so a caller can tell whether anyone changed the file afterwards. */
  readonly content: string;
}

export interface NewTicketOptions {
  /** The active environment of the project, written to `ambiente`. */
  readonly environment?: string;
}

/** The template of `type`; an unknown type lists the available ones, a malformed template names its file. */
export function readTicketTemplate(templatesDir: string, type: string): TicketTemplate {
  const types = listTicketTypes(templatesDir);
  if (!types.includes(type)) {
    throw new ProjectsError(unknownTicketTypeMessage(type, types));
  }
  const file = path.join(templatesDir, `${type}${TEMPLATE_EXTENSION}`);
  return wrapProjects(() => parseTicketTemplate(readJsonFile(file), file));
}

/** Each ticket type with what it is for, in the order of `listTicketTypes`. */
export function describeTicketTypes(
  templatesDir: string,
): readonly { readonly type: string; readonly description: string }[] {
  return listTicketTypes(templatesDir).map((type) => ({
    type,
    description: readTicketTemplate(templatesDir, type).description,
  }));
}

/**
 * The next ticket of `project` from the `type` template, with the fields the CLI knows filled in
 * (`ticket`, `tipo`, `projeto`, `ambiente`) and every other one as the template has it — `CHANGE_ME`
 * where someone still has to write. Nothing is written: `createTicket` does that.
 */
export function planTicket(
  projectsDir: string,
  project: string,
  type: string,
  templatesDir: string,
  options: NewTicketOptions = {},
): NewTicket {
  const { fields } = readTicketTemplate(templatesDir, type);
  const suffix = nextTicketSuffix(projectsDir, project);
  const ticket = fullTicket(project, suffix);
  const fixed = {
    ticket,
    tipo: type,
    projeto: project,
    ...(options.environment === undefined ? {} : { ambiente: options.environment }),
  };
  // The CLI's fields come first in the file and win over anything the template says for them.
  const json = { ...fixed, ...fields, ...fixed };
  return { ticket, path: ticketFilePath(projectsDir, project, suffix), content: `${JSON.stringify(json, null, 2)}\n` };
}

/** Writes the ticket `planTicket` describes and returns it. */
export function createTicket(
  projectsDir: string,
  project: string,
  type: string,
  templatesDir: string,
  options: NewTicketOptions = {},
): NewTicket {
  const planned = planTicket(projectsDir, project, type, templatesDir, options);
  fs.mkdirSync(path.dirname(planned.path), { recursive: true });
  fs.writeFileSync(planned.path, planned.content, { flag: 'wx' });
  return planned;
}

/**
 * Where a ticket file still holds `CHANGE_ME`, alone or inside a text (`"Dado CHANGE_ME"`), as field paths
 * (`criterios[0].descricao[0]`); none when it is filled.
 */
export function ticketPlaceholders(file: string): string[] {
  return placeholderPaths(readJsonFile(file), '');
}
