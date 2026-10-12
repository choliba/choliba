import type { Writable } from '@choliba/core';

import type { SandboxPlace } from '../../common';

/** The run the footer describes: who runs it, where, and since when. */
export interface RunFooterInfo {
  readonly provider: string;
  readonly place: SandboxPlace;
  /** When the session started, in ms (`Date#getTime`). */
  readonly startedAt: number;
}

/** The context of a run in words: provider, sandbox, image and container (`—` for the last two on this machine). */
export interface RunContextWords {
  readonly provider: string;
  readonly sandbox: string;
  readonly image: string;
  readonly container: string;
}

/** Where a running session writes: above the footer on a terminal, straight to the streams elsewhere. */
export interface RunScreen {
  readonly out: Writable;
  readonly err: Writable;
  /** Ends the screen: erases the footer and leaves the summary line in its place. */
  close(exitCode: number): void;
}
