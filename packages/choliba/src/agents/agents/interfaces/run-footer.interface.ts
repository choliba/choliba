import type { TableColumn } from '@choliba/shell';

/** The context of a run in words: provider, sandbox, image and container (`—` for the last two on this machine). */
export interface RunContextWords {
  readonly provider: string;
  readonly model: string;
  readonly sandbox: string;
  readonly image: string;
  readonly container: string;
}

/** A column of the footer's table: its title (and short title), how it shrinks, and the run's value in it. */
export interface FooterColumn {
  readonly title: string;
  readonly abbr?: string;
  readonly col: TableColumn;
  readonly value: string;
}
