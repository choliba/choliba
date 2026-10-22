import { ExpectedError } from '@choliba/kernel';

import { isRecord, PLACEHOLDER_VALUE } from '../common';

/** One `templates/ticket/<type>.json`: what the type is for, and the fields a new ticket of it starts with. */
export interface TicketTemplate {
  readonly description: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

/** `raw` as a ticket template, or why it is not one: `file` names it in the message. */
export function parseTicketTemplate(raw: unknown, file: string): TicketTemplate {
  const description = isRecord(raw) ? raw['description'] : undefined;
  const fields = isRecord(raw) ? raw['fields'] : undefined;
  if (typeof description !== 'string' || description.trim() === '' || !isRecord(fields)) {
    throw new ExpectedError(`${file}: o template precisa de "description" (texto) e "fields" (objeto).`);
  }
  return { description, fields };
}

/** Why `type` is not among `types`, when it is not. */
export function unknownTicketTypeMessage(type: string, types: readonly string[]): string {
  return `Tipo de ticket "${type}" não existe (disponíveis: ${types.join(', ')}).`;
}

/**
 * Where `value` still holds `CHANGE_ME`, alone or inside a text (`"Dado CHANGE_ME"`), as field paths
 * (`criterios[0].descricao[0]`); none when it is filled.
 */
export function placeholderPaths(value: unknown, where: string): string[] {
  if (typeof value === 'string') {
    return value.includes(PLACEHOLDER_VALUE) ? [where] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown, index) => placeholderPaths(item, `${where}[${String(index)}]`));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      placeholderPaths(item, where === '' ? key : `${where}.${key}`),
    );
  }
  return [];
}
