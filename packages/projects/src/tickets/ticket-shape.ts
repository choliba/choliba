import { shapeProblems, unknownTicketTypeProblem } from '@choliba/domain';

import { readJsonFile } from '../common';
import { listTicketTypes, readTicketTemplate } from './ticket-template';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Where the ticket in `file` departs from the template of its type (`tipo`, in `templatesDir`): a field the template
 * brings that is missing or of another kind, with its path (`criterios[2].testes: falta`). None when it keeps the
 * template's shape; an unknown or missing `tipo` is the one problem.
 */
export function ticketShapeProblems(file: string, templatesDir: string): string[] {
  const ticket = readJsonFile(file);
  const type = isRecord(ticket) ? ticket['tipo'] : undefined;
  const types = listTicketTypes(templatesDir);
  const unknown = unknownTicketTypeProblem(type, types);
  if (unknown !== undefined) return [unknown];
  const { fields } = readTicketTemplate(templatesDir, String(type));
  return shapeProblems(ticket, fields, '');
}
