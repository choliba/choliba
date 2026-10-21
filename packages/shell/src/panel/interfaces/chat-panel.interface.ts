// The panel as the rest of choliba sees it: what a run draws in, what a person answers and chooses in, and the cards
// of its header. Types only; the panel itself (OpenTUI) implements them.
import type { AnsiColor } from '../../theme';

export interface PanelKey {
  readonly name: string;
  readonly ctrl: boolean;
  readonly shift?: boolean;
  /** Keeps the key from the focused field. */
  preventDefault?(): void;
}

/** A question for the person, asked in the panel's field: words, one of `options`, or several when `multi`. */
export interface PanelQuestion {
  readonly question: string;
  readonly options: readonly string[];
  readonly multi: boolean;
}

/** The person's answer, or `skipped` when they pressed Esc. */
export type PanelReply =
  { readonly status: 'answered'; readonly answer: string | readonly string[] } | { readonly status: 'skipped' };

/** One option of a choice: its label, a detail beside it, and whether it is the one in effect now (`✔`). */
export interface PanelChoice {
  readonly label: string;
  readonly detail?: string;
  readonly current?: boolean;
}

/** What `choose` asks: a title, a sentence on what the choice is for, and the options. */
export interface PanelChooseRequest {
  readonly title: string;
  readonly description: string;
  readonly options: readonly PanelChoice[];
}

/** RGBA pixels, row after row: `stride` bytes per row, 4 per pixel, alpha not premultiplied. */
export interface ArtPixels {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly stride: number;
}

/** A welcome in the center of the empty panel: an image above some lines, both optional. */
export interface PanelSplash {
  /**
   * An image file (PNG, JPEG, WebP or GIF), drawn in half blocks with the terminal's background where it is
   * transparent; one that does not load is left out.
   */
  readonly image?: string;
  /** Lines under the image, with their escape codes, each centered; an empty one is a blank row between two. */
  readonly lines: readonly string[];
  /** A short note in the bottom right corner: the version, for instance. */
  readonly note?: string;
}

/** A header above the lines: a small icon on the left of some lines. */
export interface PanelHeader {
  /**
   * The icon's pixels, drawn in half blocks as they are, two per cell: at a header's size a picture drawn pixel by
   * pixel (`pixelMap`) reads better than a large one reduced.
   */
  readonly icon?: ArtPixels;
  /** Lines on the right of the image, with their escape codes. */
  readonly lines: readonly string[];
}

/** A card of the header: a box titled `title`, with `lines` in it, a long one wrapped between words and `---` a rule. */
export interface PanelCard {
  readonly title: string;
  readonly lines: readonly string[];
  /** The lines it shows while collapsed, three at most; its first line when absent. */
  readonly summary?: readonly string[];
  /** Lines kept at the bottom of the open card, under a rule, while its other lines scroll; none when absent. */
  readonly footer?: readonly string[];
  /** The letter that, with Ctrl, opens or collapses it (`p` for Ctrl+P), shown in its title (`^P`). */
  readonly key?: string;
  /** Its place among the cards, the lowest first (`sandbox` 1, `projeto` 2, `agente` 3); without it, after those that have one. */
  readonly order?: number;
  /** Its work is running: a spinner turns in its title until it is not. */
  readonly busy?: boolean;
  /** The color of its spinner (an agent's card, the agent's color); white when absent. */
  readonly color?: AnsiColor;
  /** Its left border in this color (an agent's card, as its lines in the conversation); gray, as the rest, when absent. */
  readonly stripe?: AnsiColor;
  /** Joined to the card before it by `>>>`: the next of a sequence. */
  readonly joined?: boolean;
  /**
   * Its situation in words (`aguardando`, `concluído · 2m10s`), centered on its first line, above its summary; while
   * busy, the spinner's bar and how long it has run (`since`) take its place, and its title has no spinner. A card that
   * says its state narrows, when the header lacks room, so every card of the flow fits.
   */
  readonly state?: string;
  /** When its work began, in ms since the epoch: the time a busy card with a `state` shows. */
  readonly since?: number;
  /** It can be dragged with the mouse onto another card that can, to take its place. */
  readonly movable?: boolean;
}

export interface PanelOptions {
  /** The title of the panel: for a run, the agent. */
  readonly title: string;
  readonly titleColor: AnsiColor;
  /** The footer's line in a width, with its escape codes: on the right of the field, or under it with a header. */
  readonly footer: (width: number) => readonly string[];
  /** What the field says while no question is pending. */
  readonly hint: string;
  /**
   * A welcome in the center of the panel, with no box nor field: Enter (or the first line written) closes it and shows
   * them; Esc calls the interrupt listeners at once. Absent, the panel opens with the field.
   */
  readonly splash?: PanelSplash;
  /**
   * A header above the lines, which then take the whole width with no border, and the footer as a status line under
   * the field. Absent, the lines are in a box titled with `title`, and the footer on the right of the field.
   */
  readonly header?: PanelHeader;
}

/** A run drawn in a panel of its own: the session's lines scroll in it, under them the footer. */
export interface Panel {
  /** Lines of the session, with their escape codes: each one is added at the bottom. */
  write(text: string): void;
  /** Draws the footer again, as it is now. */
  refresh(): void;
  /** Called when the person presses Ctrl+C, which the panel's keyboard takes before the terminal makes a signal. */
  onInterrupt(listener: () => void): void;
  /** Asks `question` in the field and gives the answer; questions asked together wait their turn. */
  ask(question: PanelQuestion): Promise<PanelReply>;
  /** Called with what the person typed and sent in the field while no question was pending. */
  onMessage(listener: (text: string) => void): void;
  /** Gives the terminal back as it was; the panel's lines are the caller's to print. */
  close(): void;
}

/** Who wrote some lines of the conversation: an agent, by its name and its color. */
export interface PanelVoice {
  readonly name: string;
  readonly color: AnsiColor;
}

/** A panel where a person talks: what they said is marked apart from the other lines, and they choose in it. */
export interface ChatPanel extends Panel {
  /**
   * Lines of the session, as `Panel.write`; with `voice`, lines that agent wrote: a border in its color on their left,
   * its name opening the block, and the lines it writes next join that block until someone else writes.
   */
  write(text: string, voice?: PanelVoice): void;
  /** What the person said, added at the bottom on a band of its own after a blank row: `❯` and the text. */
  say(text: string): void;
  /** A reply to the person, added at the bottom after a blank row: `●`, and the text's lines beside it. */
  answer(text: string): void;
  /** Asks the person to choose, in place of the field: the index chosen with Enter, or nothing on Esc. */
  choose(request: PanelChooseRequest): Promise<number | undefined>;
  /** Called with what is in the field each time it changes. */
  onTyping(listener: (text: string) => void): void;
  /**
   * Lines shown under the field, with their escape codes, while the person types, each a row `onPick` gets the
   * index of when clicked, and `hint` at the end of the field's row, in gray (what Enter does); none hides them.
   */
  suggest(lines: readonly string[], onPick?: (index: number) => void, hint?: string): void;
  /** Puts `text` in the field, in place of what was there. */
  fill(text: string): void;
  /** Called with each key the person presses in the field, before the field takes it; `true` keeps it from it. */
  onKey(listener: (key: PanelKey) => boolean): void;
  /** Called when the person drags a card that can move onto another that can: `title` takes the place of `onto`. */
  onCardMove(listener: (title: string, onto: string) => void): void;
  /** Empties the conversation: every line written, said and answered goes; the header and the field stay. */
  clear(): void;
  /** Replaces the lines of the header beside its icon; a panel with no header ignores it. */
  heading(lines: readonly string[]): void;
  /**
   * Shows these cards in the header, on the right of its lines; Ctrl and a card's key, or a click on it, collapses it to
   * its summary and opens it again. A panel with no header ignores it.
   */
  cards(cards: readonly PanelCard[]): void;
}
