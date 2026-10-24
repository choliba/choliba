import type { Writable } from '@choliba/kernel';

/** A question the agent asks through the `ask` run tool, as its script writes it. */
export interface AskQuestion {
  readonly id: string;
  readonly question: string;
  /** The choices, when the agent gave some; none is a question answered in words. */
  readonly options: readonly string[];
  /** Whether more than one of the `options` may be chosen. */
  readonly multi: boolean;
}

/** What the screen answers: the person's answer, or why there is none. */
export type AskAnswer =
  | { readonly status: 'answered'; readonly answer: string | readonly string[] }
  | { readonly status: 'skipped' }
  | { readonly status: 'unavailable' };

/** Where a running session writes: in a frame above the footer on a terminal, straight to the streams elsewhere. */
export interface RunScreen {
  /** The session's lines go in a frame titled with the agent, without the `[agent]` label on each. */
  readonly framed: boolean;
  readonly out: Writable;
  readonly err: Writable;
  /** What the person must not miss (a message that did not reach the agent): a warning in the panel, `err` elsewhere. */
  readonly warn: Writable;
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
