// The panel between the agent's frame and the footer's table: the last lines of what the provider is reasoning.

import { frameBottom, frameLines, frameTop } from '@choliba/core';

/** How many lines of reasoning the panel shows. */
export const THINKING_LINES = 5;

/** The panel's title. */
const TITLE = 'pensando';

/** How much of the reasoning is kept: far more than five lines of any terminal, so the buffer never grows. */
const KEPT_CHARACTERS = 4096;

/**
 * The reasoning a session streams, in pieces, and the panel that shows its last `THINKING_LINES` lines. A thought
 * that ends (the provider did something else) makes the next one start on a line of its own.
 */
export class ThinkingPanel {
  private text = '';
  private ended = false;

  /** One more piece of the reasoning. */
  append(piece: string): void {
    const separator = this.ended && this.text !== '' ? '\n' : '';
    this.ended = false;
    this.text = `${this.text}${separator}${piece}`.slice(-KEPT_CHARACTERS);
  }

  /** The provider stopped reasoning: what comes next is another thought. */
  end(): void {
    this.ended = true;
  }

  /**
   * The panel in `width` columns: a frame titled `pensando` around the last
   * `THINKING_LINES` lines, as tall from the first piece on so the footer does not jump, without
   * blank lines. Nothing before any reasoning.
   */
  lines(width: number): readonly string[] {
    // A blank line between paragraphs would take one of the few lines there are.
    const reasoning = this.text.trim().replaceAll(/\n\s*\n/g, '\n');
    if (reasoning === '') return [];
    const shown = frameLines(reasoning, width).slice(-THINKING_LINES);
    const blank = frameLines('', width).join('');
    const padding = Array.from({ length: THINKING_LINES - shown.length }, () => blank);
    return [frameTop(TITLE, width), ...shown, ...padding, frameBottom(width)];
  }
}
