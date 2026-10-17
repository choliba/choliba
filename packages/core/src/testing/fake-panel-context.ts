import type { PanelContext } from '../shell';
import type { ChatPanel, PanelCard, PanelKey } from '../terminal';

/** A `PanelContext` for specs: its values, and what it shows, as plain maps, and the keys it would get. */
export interface FakePanelContext {
  readonly context: PanelContext;
  readonly values: Map<string, string>;
  /** Each card shown, by title, as last shown. */
  readonly cards: Map<string, Omit<PanelCard, 'title'>>;
  readonly labels: Map<string, string>;
  readonly statuses: Map<string, string>;
  /** The titles of the cards whose spinner turns. */
  readonly spinning: Set<string>;
  /** The person presses `name` (with Shift when `shift`): `true` when a listener took it. */
  press(name: string, shift?: boolean): boolean;
  /** The person sends `text` with no `/` in `panel`: `true` when a conversation took it. */
  send(text: string, panel: ChatPanel): boolean;
  /** Ctrl+C twice: `true` when something is running, and was asked to stop. */
  stop(): boolean;
}

/** A context that keeps what is set and shown, for a spec to read. */
export function fakePanelContext(): FakePanelContext {
  const values = new Map<string, string>();
  const cards = new Map<string, Omit<PanelCard, 'title'>>();
  const labels = new Map<string, string>();
  const statuses = new Map<string, string>();
  const spinning = new Set<string>();
  const keys: ((key: PanelKey) => boolean)[] = [];
  const changes: ((key: string | undefined) => void)[] = [];
  let conversation: ((text: string, panel: ChatPanel) => void) | undefined;
  let running: (() => void) | undefined;
  const stop = (): boolean => {
    const current = running;
    current?.();
    return current !== undefined;
  };
  const keep = <T>(map: Map<string, T>, key: string, value: T | undefined): void => {
    if (value === undefined) map.delete(key);
    else map.set(key, value);
  };
  const context: PanelContext = {
    get: (key) => values.get(key),
    set: (key, value) => {
      keep(values, key, value);
      for (const listener of changes) listener(key);
    },
    onChange: (listener) => {
      changes.push(listener);
    },
    show: (title, card) => {
      keep(cards, title, card);
    },
    spin: (title, busy) => {
      if (busy) spinning.add(title);
      else spinning.delete(title);
    },
    label: (name, value) => {
      keep(labels, name, value);
    },
    status: (name, line) => {
      keep(statuses, name, line);
    },
    onKey: (listener) => {
      keys.push(listener);
    },
    converse: (handler) => {
      conversation = handler;
    },
    busy: (work) => {
      running = work;
    },
    clear: () => {
      stop();
      for (const map of [values, cards, labels, statuses]) map.clear();
      spinning.clear();
      for (const listener of changes) listener(undefined);
    },
  };
  return {
    context,
    values,
    cards,
    labels,
    statuses,
    spinning,
    press: (name, shift = false) => keys.some((listener) => listener({ name, ctrl: false, shift })),
    send: (text, panel) => {
      conversation?.(text, panel);
      return conversation !== undefined;
    },
    stop,
  };
}
