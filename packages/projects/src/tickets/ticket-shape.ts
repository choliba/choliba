import { readJsonFile } from '../common';
import { listTicketTypes, readTicketTemplate } from './ticket-template';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What kind of JSON value `value` is, as a message names it. */
function kindOf(value: unknown): string {
  if (Array.isArray(value)) return 'uma lista';
  if (isRecord(value)) return 'um objeto';
  if (typeof value === 'string') return 'um texto';
  if (typeof value === 'number') return 'um número';
  if (typeof value === 'boolean') return 'um booleano';
  return 'null';
}

function child(where: string, key: string): string {
  return where === '' ? key : `${where}.${key}`;
}

/**
 * Where `value` departs from `model`, a value of a ticket template: a field the model has that is missing or of another
 * kind, at any depth. An item of a list whose model starts with an object is held to that object (each criterion to
 * the template's first). Fields the model does not have are left alone.
 */
function shapeProblems(value: unknown, model: unknown, where: string): string[] {
  if (kindOf(value) !== kindOf(model)) return [`${where}: deve ser ${kindOf(model)}, não ${kindOf(value)}`];
  if (isRecord(model) && isRecord(value)) {
    return Object.entries(model).flatMap(([key, field]) =>
      key in value ? shapeProblems(value[key], field, child(where, key)) : [`${child(where, key)}: falta`],
    );
  }
  const first: unknown = Array.isArray(model) ? model[0] : undefined;
  if (!Array.isArray(value) || !isRecord(first)) return [];
  return value.flatMap((item: unknown, index) => shapeProblems(item, first, `${where}[${String(index)}]`));
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
  if (typeof type !== 'string' || !types.includes(type)) {
    return [`tipo: deve ser um dos tipos de ticket (${types.join(', ')})`];
  }
  const { fields } = readTicketTemplate(templatesDir, type);
  return shapeProblems(ticket, fields, '');
}
