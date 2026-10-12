import type { ColumnLayout, PlacedCell, TableAlign, TableColumn, TableRow } from './interfaces/table.interface';

/** The spaces between two columns. */
export const COLUMN_GAP = 2;

const ELLIPSIS = '…';

const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** The characters of `text` as a person sees them (an accent with its letter is one). */
function graphemes(text: string): readonly string[] {
  return Array.from(GRAPHEMES.segment(text), ({ segment }) => segment);
}

/** How many terminal columns `text` takes: one per character (choliba's texts have no wide characters). */
export function textWidth(text: string): number {
  return graphemes(text).length;
}

/** Each cell of `row` with the column it starts at, the spans counted. */
export function placeCells(row: TableRow): readonly PlacedCell[] {
  let start = 0;
  return row.map((cell) => {
    const placed = { cell, start };
    start += cell.colspan;
    return placed;
  });
}

/** How many columns `row` takes, its spans counted. */
export function rowColumns(row: TableRow): number {
  return row.reduce((sum, cell) => sum + cell.colspan, 0);
}

/** The width of `columns` side by side, with the gaps between them. */
export function spanWidth(columns: readonly ColumnLayout[]): number {
  return columns.reduce((sum, column) => sum + column.width, 0) + COLUMN_GAP * Math.max(columns.length - 1, 0);
}

/** The `<col>`s expanded to one rule per column. */
function columnRules(cols: readonly TableColumn[]): readonly Omit<ColumnLayout, 'natural' | 'width'>[] {
  return cols.flatMap((col) =>
    Array.from({ length: col.span ?? 1 }, () => ({
      align: col.align ?? 'left',
      minWidth: col.minWidth ?? 1,
      shrink: col.shrink ?? false,
    })),
  );
}

/** The widest single-column cell that starts at `column`. */
function widestCell(cells: readonly PlacedCell[], column: number): number {
  const widths = cells
    .filter(({ cell, start }) => start === column && cell.colspan === 1)
    .map(({ cell }) => textWidth(cell.text));
  return Math.max(0, ...widths);
}

/** Grows the last column a spanning cell covers until its text fits across the span. */
function fitSpan(columns: readonly ColumnLayout[], { cell, start }: PlacedCell): void {
  const covered = columns.slice(start, start + cell.colspan);
  const missing = textWidth(cell.text) - spanWidth(covered);
  const last = covered.at(-1);
  if (missing > 0 && last !== undefined) last.width += missing;
}

/**
 * The `count` columns of `rows`, each as wide as its widest single cell and then wide enough for the cells that span
 * it; the rules from `cols`, the columns it does not describe left-aligned, growing and shrinking alike.
 */
export function layColumns(
  cols: readonly TableColumn[],
  rows: readonly TableRow[],
  count: number,
): readonly ColumnLayout[] {
  const cells = rows.flatMap(placeCells);
  const rules = columnRules(cols);
  const columns = Array.from({ length: count }, (_, index) => {
    const width = widestCell(cells, index);
    return { align: 'left' as const, minWidth: 1, shrink: false, ...rules.at(index), natural: 0, width };
  });
  cells
    .filter(({ cell }) => cell.colspan > 1)
    .forEach((placed) => {
      fitSpan(columns, placed);
    });
  return columns.map((column) => ({ ...column, natural: column.width }));
}

/** The column to narrow next: the widest one still above its minimum, among `candidates`. */
function widestAboveMinimum(candidates: readonly ColumnLayout[]): ColumnLayout | undefined {
  return candidates
    .filter((column) => column.width > column.minWidth)
    .reduce<ColumnLayout | undefined>(
      (found, column) => (column.width > (found?.width ?? 0) ? column : found),
      undefined,
    );
}

/**
 * Narrows `columns` to fit `available`: one at a time, the widest first, the ones marked `shrink` before the rest, none
 * below its `minWidth`. A table that cannot fit at the minimums stays at them.
 */
export function fitColumns(columns: readonly ColumnLayout[], available: number): void {
  for (const candidates of [columns.filter((column) => column.shrink), columns]) {
    let column = widestAboveMinimum(candidates);
    while (spanWidth(columns) > available && column !== undefined) {
      column.width -= 1;
      column = widestAboveMinimum(candidates);
    }
  }
}

/** `text` cut to `width`, ending in `…` when it did not fit. */
export function truncate(text: string, width: number): string {
  const letters = graphemes(text);
  if (letters.length <= width) return text;
  if (width <= 0) return '';
  return `${letters.slice(0, width - 1).join('')}${ELLIPSIS}`;
}

/** The spaces before and after `text` to place it in `width`, as `align` says. */
export function padding(text: string, width: number, align: TableAlign): readonly [string, string] {
  const room = Math.max(width - textWidth(text), 0);
  const before = { left: 0, right: room, center: Math.floor(room / 2) }[align];
  return [' '.repeat(before), ' '.repeat(room - before)];
}
