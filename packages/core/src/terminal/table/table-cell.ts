import type { HeaderCellOptions, CellOptions, TableCell } from './interfaces/table.interface';

export class TableError extends Error {}

function cell(text: string, header: boolean, options: HeaderCellOptions): TableCell {
  if ((options.rowspan ?? 1) !== 1) {
    throw new TableError(`rowspan não é suportado na tabela do terminal (célula "${text}").`);
  }
  const colspan = options.colspan ?? 1;
  if (!Number.isInteger(colspan) || colspan < 1) {
    throw new TableError(`colspan precisa ser um inteiro maior que zero (célula "${text}").`);
  }
  return { text, header, colspan, ...(options.abbr === undefined ? {} : { abbr: options.abbr }) };
}

/** A header cell, as `<th>`: drawn strong, with an optional `abbr` for a narrow column. */
export function th(text: string, options: HeaderCellOptions = {}): TableCell {
  return cell(text, true, options);
}

/** A data cell, as `<td>`. */
export function td(text: string, options: CellOptions = {}): TableCell {
  return cell(text, false, options);
}
