import type {
  ColumnLayout,
  TableAlign,
  TableCell,
  TableRow,
  TableSpec,
  TableStyle,
} from './interfaces/table.interface';
import {
  fitColumns,
  layColumns,
  padding,
  placeCells,
  rowColumns,
  spanWidth,
  textWidth,
  truncate,
  COLUMN_GAP,
} from './table-layout';

const RULE = '─';

/** A table for the terminal, modeled on HTML's `<table>`: build it once, `render` it to any width. */
export class Table {
  private readonly groups: readonly (readonly TableRow[])[];

  constructor(private readonly spec: TableSpec) {
    this.groups = [spec.head ?? [], ...(spec.bodies ?? []), spec.foot ?? []].filter((group) => group.length > 0);
  }

  /** Whether the table fits in `width` cutting only the columns its `cols` mark to shrink. */
  fits(width: number): boolean {
    const columns = this.columns(width);
    return spanWidth(columns) <= width && columns.every((column) => column.width === column.natural || column.shrink);
  }

  /** The lines of the table in `width` columns, without writing anything: wider content is cut with `…`. */
  render(width: number, style: TableStyle = {}): readonly string[] {
    const columns = this.columns(width);
    const rule = RULE.repeat(Math.min(spanWidth(columns), width));
    const body = this.groups.flatMap((group, index) => [
      ...(index > 0 && this.spec.rules !== 'none' ? [rule] : []),
      ...this.groupLines(group, columns, style, rule),
    ]);
    const caption = this.spec.caption === undefined ? [] : [truncate(this.spec.caption, width)];
    return [...caption, ...body];
  }

  /** The columns laid out for this table's rows and fitted to `width`. */
  private columns(width: number): readonly ColumnLayout[] {
    const rows = this.groups.flat();
    const columns = layColumns(this.spec.cols ?? [], rows, Math.max(0, ...rows.map(rowColumns)));
    fitColumns(columns, width);
    return columns;
  }

  private groupLines(
    group: readonly TableRow[],
    columns: readonly ColumnLayout[],
    style: TableStyle,
    rule: string,
  ): readonly string[] {
    return group.flatMap((row, index) => [
      ...(index > 0 && this.spec.rules === 'rows' ? [rule] : []),
      rowLine(row, columns, style),
    ]);
  }
}

/** The text a cell shows in `width`: its `abbr` when the full text does not fit and the abbreviation does. */
function shownText(cell: TableCell, width: number): string {
  if (textWidth(cell.text) <= width || cell.abbr === undefined) return truncate(cell.text, width);
  return truncate(cell.abbr, width);
}

/** One cell in the columns it spans: its text cut or abbreviated to fit, padded as its first column aligns. */
function cellText(cell: TableCell, spanned: readonly ColumnLayout[], strong: (text: string) => string): string {
  const width = spanWidth(spanned);
  const text = shownText(cell, width);
  // The first spanned column's alignment: reduceRight ends on it (and stays `left` for no column).
  const align = spanned.reduceRight<TableAlign>((_, column) => column.align, 'left');
  const [before, after] = padding(text, width, align);
  return `${before}${cell.header ? strong(text) : text}${after}`;
}

/** One row in the columns' widths: each cell in the columns it spans, the columns it does not fill left blank. */
function rowLine(row: TableRow, columns: readonly ColumnLayout[], style: TableStyle): string {
  const strong = style.strong ?? ((text: string) => text);
  const cells = placeCells(row).map(({ cell, start }) =>
    cellText(cell, columns.slice(start, start + cell.colspan), strong),
  );
  const empty = columns.slice(rowColumns(row)).map((column) => ' '.repeat(column.width));
  return [...cells, ...empty].join(' '.repeat(COLUMN_GAP)).trimEnd();
}
