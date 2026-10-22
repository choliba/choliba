import { isRecord } from '../common';

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
export function shapeProblems(value: unknown, model: unknown, where: string): string[] {
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

/** Why `tipo` is not a known ticket type, when it is not. */
export function unknownTicketTypeProblem(type: unknown, types: readonly string[]): string | undefined {
  if (typeof type === 'string' && types.includes(type)) return undefined;
  return `tipo: deve ser um dos tipos de ticket (${types.join(', ')})`;
}
