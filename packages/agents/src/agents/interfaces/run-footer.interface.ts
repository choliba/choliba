import type { TableColumn, Writable } from '@choliba/core';
import type { SandboxPlace } from '@choliba/sandbox';

import type { AskAnswer, AskQuestion } from '../../common';

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

/** Where a running session writes: in a frame above the footer on a terminal, straight to the streams elsewhere. */
export interface RunScreen {
  /** The session's lines go in a frame titled with the agent, without the `[agent]` label on each. */
  readonly framed: boolean;
  readonly out: Writable;
  readonly err: Writable;
  /** The model the provider reported, for the footer. */
  model(name: string): void;
  /** Called when the person interrupts the run from the screen itself (Ctrl+C in the panel, which takes the keyboard). */
  onInterrupt(listener: () => void): void;
  /** Called with what the person typed and sent in the screen's field (the panel's); never, on a screen with none. */
  onMessage(listener: (text: string) => void): void;
  /** Answers a question of the `ask` run tool: the panel asks the person; a screen that cannot, says so at once. */
  answer(question: AskQuestion): Promise<AskAnswer>;
  /** Ends the screen: erases the footer and leaves the summary line in its place. */
  close(exitCode: number): void;
}

/** A column of the footer's table: its title (and short title), how it shrinks, and the run's value in it. */
export interface FooterColumn {
  readonly title: string;
  readonly abbr?: string;
  readonly col: TableColumn;
  readonly value: string;
}
