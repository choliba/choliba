import type { ChatPanel, PanelCard, PanelChooseRequest, PanelKey } from '../terminal';

/** A `ChatPanel` for specs: what was written, said, suggested and asked, and the person's side of it. */
export interface FakeChatPanel {
  readonly panel: ChatPanel;
  /** What was written, and what was answered: a spec reads them as one conversation. */
  readonly written: string[];
  readonly said: string[];
  readonly suggested: (readonly string[])[];
  readonly headings: (readonly string[])[];
  /** Each set of cards shown in the header. */
  readonly cards: (readonly PanelCard[])[];
  readonly choices: PanelChooseRequest[];
  /** What was put in the field with `fill`. */
  readonly filled: string[];
  /** The person clicks the suggestion at `index`. */
  click(index: number): void;
  /** What the next `choose` gives: an index, or nothing as Esc. */
  answer(index: number | undefined): void;
  /** The person sends `text` from the field. */
  send(text: string): void;
  /** The person types `text` in the field. */
  type(text: string): void;
  /** The person presses `name` in the field: `true` when a listener took it. */
  press(name: string): boolean;
  /** The person presses Ctrl+C twice. */
  interrupt(): void;
  readonly closed: () => boolean;
}

/** A panel that keeps what it is given and lets a spec act as the person; `choose` gives the first option. */
export function fakeChatPanel(): FakeChatPanel {
  const written: string[] = [];
  const said: string[] = [];
  const suggested: (readonly string[])[] = [];
  const headings: (readonly string[])[] = [];
  const cards: (readonly PanelCard[])[] = [];
  const choices: PanelChooseRequest[] = [];
  const messages: ((text: string) => void)[] = [];
  const typing: ((text: string) => void)[] = [];
  const keys: ((key: PanelKey) => boolean)[] = [];
  const interrupts: (() => void)[] = [];
  let answer: number | undefined = 0;
  let picker: ((index: number) => void) | undefined;
  const filled: string[] = [];
  let closed = false;
  const panel: ChatPanel = {
    write: (text) => {
      written.push(text);
    },
    say: (text) => {
      said.push(text);
    },
    answer: (text) => {
      written.push(text);
    },
    choose: (request) => {
      choices.push(request);
      return Promise.resolve(answer);
    },
    onTyping: (listener) => {
      typing.push(listener);
    },
    onKey: (listener) => {
      keys.push(listener);
    },
    suggest: (lines, onPick) => {
      suggested.push(lines);
      picker = onPick;
    },
    fill: (text) => {
      filled.push(text);
    },
    heading: (lines) => {
      headings.push(lines);
    },
    cards: (shown) => {
      cards.push(shown);
    },
    refresh: () => undefined,
    onInterrupt: (listener) => {
      interrupts.push(listener);
    },
    ask: () => Promise.resolve({ status: 'skipped' }),
    onMessage: (listener) => {
      messages.push(listener);
    },
    close: () => {
      closed = true;
    },
  };
  return {
    panel,
    written,
    said,
    suggested,
    headings,
    cards,
    choices,
    filled,
    click: (index) => {
      picker?.(index);
    },
    answer: (index) => {
      answer = index;
    },
    send: (text) => {
      messages.forEach((listener) => {
        listener(text);
      });
    },
    type: (text) => {
      typing.forEach((listener) => {
        listener(text);
      });
    },
    press: (name) => keys.some((listener) => listener({ name, ctrl: false })),
    interrupt: () => {
      interrupts.forEach((listener) => {
        listener();
      });
    },
    closed: () => closed,
  };
}
