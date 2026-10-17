import { messageOf } from '../cli';
import type { ChatPanel, PanelCard, PanelKey } from '../terminal';
import type { Container } from './container';
import type { PanelCommand, PanelContext } from './interfaces/shell.interface';

/** What the panel says to a `/word` no command starts with. */
function unknownCommand(word: string): string {
  return `\u001b[33mComando desconhecido: /${word}. Digite / para ver os comandos.\u001b[39m`;
}

/**
 * The commands that start with what follows the `/`, under the field: the highlighted one marked with `❯`, and one
 * that cannot run now all in gray, with why in place of what it does.
 */
function suggestionLines(
  commands: readonly PanelCommand[],
  highlighted: number,
  why: (command: PanelCommand) => string | undefined,
): readonly string[] {
  const width = Math.max(0, ...commands.map((command) => command.name.length));
  return commands.map((command, index) => {
    const name = `/${command.name.padEnd(width)}`;
    const reason = why(command);
    if (reason !== undefined) return `\u001b[90m  ${name}  ${reason}\u001b[39m`;
    // The highlighted command's description lights up; the others stay in gray.
    return index === highlighted
      ? `\u001b[1m❯ ${name}\u001b[22m  ${command.description}`
      : `  ${name}  \u001b[90m${command.description}\u001b[39m`;
  });
}

/** The word after the `/` of what is typed, while it is one: a `/` and no space yet. */
function slashWord(text: string): string | undefined {
  return text.startsWith('/') && !text.includes(' ') ? text.slice(1) : undefined;
}

/** What the context shows in the header: its cards, and the `name value` lines of its column. */
interface ContextView {
  cards(cards: readonly PanelCard[]): void;
  labels(lines: readonly string[]): void;
  status(parts: readonly string[]): void;
  onKey(listener: (key: PanelKey) => boolean): void;
  converse(handler: ((text: string, panel: ChatPanel) => void) | undefined): void;
  busy(stop: (() => void) | undefined): void;
  /** Stops what runs; the context forgets its own state after. */
  stop(): void;
  /** Once the context is clear: what the packages show in a new session shows again. */
  restart(): void;
}

/** The session's context: its values, and the cards and labels they show in the header, each in the order it came. */
function sessionContext(view: ContextView): PanelContext {
  const values = new Map<string, string>();
  const cards = new Map<string, PanelCard>();
  const labels = new Map<string, string>();
  const statuses = new Map<string, string>();
  const changes: ((key: string | undefined) => void)[] = [];
  const changed = (key: string | undefined): void => {
    for (const listener of changes) listener(key);
  };
  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
      changed(key);
    },
    onChange: (listener) => {
      changes.push(listener);
    },
    show: (title, card) => {
      if (card === undefined) cards.delete(title);
      else cards.set(title, { ...card, title });
      const place = (each: PanelCard): number => each.order ?? Number.MAX_SAFE_INTEGER;
      view.cards([...cards.values()].sort((one, other) => place(one) - place(other)));
    },
    label: (name, value) => {
      if (value === undefined) labels.delete(name);
      else labels.set(name, value);
      view.labels([...labels].map(([each, shown]) => `\u001b[90m${each}\u001b[39m ${shown}`));
    },
    status: (name, line) => {
      if (line === undefined) statuses.delete(name);
      else statuses.set(name, line);
      view.status([...statuses.values()]);
    },
    onKey: (listener) => {
      view.onKey(listener);
    },
    converse: (handler) => {
      view.converse(handler);
    },
    busy: (stop) => {
      view.busy(stop);
    },
    clear: () => {
      view.stop();
      for (const map of [values, cards, labels, statuses]) map.clear();
      view.cards([]);
      view.labels([]);
      view.status([]);
      view.restart();
      changed(undefined);
    },
  };
}

/** What a session tells its panel: the footer's parts, and what to stop before Ctrl+C closes the panel. */
export interface PanelSession {
  /** The parts the commands put in the status line, then the keys of the cards shown. */
  status(): readonly string[];
  /** Stops the work running now: `true` when there was some, and then the panel stays open. */
  stop(): boolean;
}

/**
 * The panel's session: while a `/word` is typed, the commands that start with it show under the field, ↑ and ↓ move
 * the highlight over the ones that can run, Tab puts the highlighted one in the field, a click runs one, and Esc hides
 * them; Enter runs the command named whole, else the highlighted one. A command that cannot run says why. Anything
 * else is said, and goes to the conversation a command set, if any. The cards the commands show go in the header, and
 * their labels in its column, under `heading`. Each of `starts` shows what its package shows in a new session, as the
 * session begins and again after the context is cleared.
 */
export function panelSession(
  container: Container,
  panel: ChatPanel,
  commands: readonly PanelCommand[],
  heading: readonly string[],
  starts: readonly ((container: Container, context: PanelContext) => void)[] = [],
): PanelSession {
  let shortcuts: readonly string[] = [];
  let parts: readonly string[] = [];
  const keyListeners: ((key: PanelKey) => boolean)[] = [];
  let conversation: ((text: string, panel: ChatPanel) => void) | undefined;
  let running: (() => void) | undefined;
  const stopRunning = (): boolean => {
    const stop = running;
    running = undefined;
    stop?.();
    return stop !== undefined;
  };
  const context = sessionContext({
    cards: (cards) => {
      panel.cards(cards);
      shortcuts = cards.flatMap((card) =>
        card.key === undefined ? [] : [`\u001b[90mCtrl+${card.key.toUpperCase()} ${card.title}\u001b[39m`],
      );
      panel.refresh();
    },
    labels: (lines) => {
      panel.heading([...heading, ...lines]);
    },
    status: (shown) => {
      parts = shown;
      panel.refresh();
    },
    onKey: (listener) => {
      keyListeners.push(listener);
    },
    converse: (handler) => {
      conversation = handler;
    },
    busy: (stop) => {
      running = stop;
    },
    stop: () => {
      stopRunning();
    },
    restart: () => {
      begin();
    },
  });
  const begin = (): void => {
    for (const start of starts) start(container, context);
  };
  begin();
  const matching = (word: string): readonly PanelCommand[] =>
    commands.filter((command) => command.name.startsWith(word));
  const why = (command: PanelCommand): string | undefined => command.unavailable?.(context, container);
  let shown: readonly PanelCommand[] = [];
  let highlighted = 0;
  let filter: string | undefined;
  const show = (found: readonly PanelCommand[]): void => {
    shown = found;
    panel.suggest(suggestionLines(found, highlighted, why), (index) => {
      clicked(index);
    });
  };
  /** The next command from `from` by `step` that can run, around the list; `from` itself when none can. */
  const nextAvailable = (from: number, step: number): number => {
    for (let moved = 1; moved <= shown.length; moved += 1) {
      const index = (((from + step * moved) % shown.length) + shown.length) % shown.length;
      const command = shown[index];
      if (command !== undefined && why(command) === undefined) return index;
    }
    return from;
  };
  const run = async (command: PanelCommand): Promise<void> => {
    const reason = why(command);
    if (reason !== undefined) {
      panel.answer(`\u001b[33m${reason}\u001b[39m`);
      return;
    }
    try {
      await command.run({
        container,
        panel: {
          ...panel,
          write: (text) => {
            panel.answer(text);
          },
        },
        context,
      });
    } catch (error) {
      panel.answer(`\u001b[31merro: ${messageOf(error)}\u001b[39m`);
    }
  };
  const clicked = (index: number): void => {
    const command = shown[index];
    if (command === undefined || why(command) !== undefined) return;
    panel.fill('');
    panel.say(`/${command.name}`);
    void run(command);
  };
  // Sending clears the field before the message comes: the highlight stays for it, and only a new word moves it back.
  panel.onTyping((text) => {
    const word = slashWord(text);
    const found = word === undefined ? [] : matching(word);
    if (word !== undefined && word !== filter) {
      filter = word;
      shown = found;
      highlighted = nextAvailable(-1, 1);
    }
    show(found);
  });
  panel.onKey((key) => {
    if (shown.length === 0) return keyListeners.some((listener) => listener(key));
    const command = shown[highlighted];
    if (key.name === 'escape') show([]);
    else if (key.name === 'tab') {
      if (command !== undefined && why(command) === undefined) panel.fill(`/${command.name}`);
    } else if (key.name === 'down' || key.name === 'up') {
      highlighted = nextAvailable(highlighted, key.name === 'down' ? 1 : -1);
      show(shown);
    } else return false;
    return true;
  });
  panel.onMessage((text) => {
    show([]);
    const word = text.startsWith('/') ? text.slice(1).trim() : undefined;
    const choice = highlighted;
    highlighted = 0;
    filter = undefined;
    const found = word === undefined ? [] : matching(word);
    const command = commands.find((each) => each.name === word) ?? found[Math.min(choice, found.length - 1)];
    // The band says the command that runs, not the start of it that was typed (`/`, `/p`).
    panel.say(command === undefined ? text : `/${command.name}`);
    if (word === undefined) {
      conversation?.(text, panel);
      return;
    }
    if (command === undefined) {
      panel.answer(unknownCommand(word));
      return;
    }
    void run(command);
  });
  return { status: () => [...parts, ...shortcuts], stop: stopRunning };
}
