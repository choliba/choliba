/** Where a column's text sits in its width: CSS's `text-align`. */
export type TableAlign = 'left' | 'right' | 'center';

/** One cell of a row: a header cell (`<th>`) or a data cell (`<td>`). */
export interface TableCell {
  readonly text: string;
  /** `<th>`: drawn with the table's `strong` style. */
  readonly header: boolean;
  /** How many columns it takes (`colspan`); 1 when absent. */
  readonly colspan: number;
  /** `<th abbr>`: the short text used when its column is narrower than `text`. */
  readonly abbr?: string;
}

/** What `th` and `td` take besides the text. `rowspan` is refused: the terminal table has no row spans. */
export interface CellOptions {
  readonly colspan?: number;
  readonly rowspan?: number;
}

export interface HeaderCellOptions extends CellOptions {
  readonly abbr?: string;
}

/** One row (`<tr>`): its cells, left to right. */
export type TableRow = readonly TableCell[];

/** One `<col>`: how its columns (`span`, 1 when absent) align, how narrow they may get, and whether they give way first. */
export interface TableColumn {
  readonly span?: number;
  readonly align?: TableAlign;
  /** The width it never goes below when the table has to shrink (1 when absent). */
  readonly minWidth?: number;
  /** Gives way first when the table is wider than the terminal. */
  readonly shrink?: boolean;
}

/** One column of a laid-out table: its rules, the width its content asks for, and the width it gets. */
export interface ColumnLayout {
  readonly align: TableAlign;
  readonly minWidth: number;
  readonly shrink: boolean;
  readonly natural: number;
  width: number;
}

/** A cell and the column it starts at. */
export interface PlacedCell {
  readonly cell: TableCell;
  readonly start: number;
}

/** The `─` lines between rows: none, between the groups (head, each body, foot), or between every row. */
export type TableRules = 'none' | 'groups' | 'rows';

/**
 * A table as HTML's `<table>` has it, in the same order: an optional `caption`, the `cols` (`<colgroup>`/`<col>`), at
 * most one `head` (`<thead>`), any number of `bodies` (`<tbody>`), at most one `foot` (`<tfoot>`); rows of `th`/`td`.
 */
export interface TableSpec {
  readonly caption?: string;
  readonly cols?: readonly TableColumn[];
  readonly head?: readonly TableRow[];
  readonly bodies?: readonly (readonly TableRow[])[];
  readonly foot?: readonly TableRow[];
  /** `groups` when absent. */
  readonly rules?: TableRules;
}

/** How the table is drawn: the style of the header cells (`<th>`), bold on a colored terminal; none when absent. */
export interface TableStyle {
  readonly strong?: (text: string) => string;
}
