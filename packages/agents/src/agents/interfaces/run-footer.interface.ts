import type { TableColumn } from '@choliba/core';
import type { SandboxPlace } from '@choliba/sandbox';

export type { AskAnswer, AskQuestion, RunScreen } from '@choliba/engine';

/** The run the footer describes: who runs it, where, and since when. */
export interface RunFooterInfo {
  readonly provider: string;
  readonly place: SandboxPlace;
  /** When the session started, in ms (`Date#getTime`). */
  readonly startedAt: number;
  /** The model asked of the provider, then the one it reports in its `init` event (`Auto`); absent with neither. */
  readonly model?: string;
}

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
