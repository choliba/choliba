import type { PanelContext } from '../shell';
import type { PanelCard, PanelKey } from '../terminal';

/** A `PanelContext` for specs: its values, and what it shows, as plain maps, and the keys it would get. */
export interface FakePanelContext {
  readonly context: PanelContext;
  readonly values: Map<string, string>;
  /** Each card shown, by title, as last shown. */
  readonly cards: Map<string, Omit<PanelCard, 'title'>>;
  readonly labels: Map<string, string>;
  readonly statuses: Map<string, string>;
  /** The person presses `name` (with Shift when `shift`): `true` when a listener took it. */
  press(name: string, shift?: boolean): boolean;
}

/** A context that keeps what is set and shown, for a spec to read. */
export function fakePanelContext(): FakePanelContext {
  const values = new Map<string, string>();
  const cards = new Map<string, Omit<PanelCard, 'title'>>();
  const labels = new Map<string, string>();
  const statuses = new Map<string, string>();
  const keys: ((key: PanelKey) => boolean)[] = [];
  const keep = <T>(map: Map<string, T>, key: string, value: T | undefined): void => {
    if (value === undefined) map.delete(key);
    else map.set(key, value);
  };
  const context: PanelContext = {
    get: (key) => values.get(key),
    set: (key, value) => {
      keep(values, key, value);
    },
    show: (title, card) => {
      keep(cards, title, card);
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
  };
  return {
    context,
    values,
    cards,
    labels,
    statuses,
    press: (name, shift = false) => keys.some((listener) => listener({ name, ctrl: false, shift })),
  };
}
