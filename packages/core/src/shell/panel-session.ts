import { messageOf } from '../cli';
import type { ChatPanel, PanelCard } from '../terminal';
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
    const description = `\u001b[90m${command.description}\u001b[39m`;
    return index === highlighted ? `\u001b[1m❯ ${name}\u001b[22m  ${description}` : `  ${name}  ${description}`;
  });
}

/** The word after the `/` of what is typed, while it is one: a `/` and no space yet. */
function slashWord(text: string): string | undefined {
  return text.startsWith('/') && !text.includes(' ') ? text.slice(1) : undefined;
}

/** The session's context: its values, and the cards they show in the header, in the order each was first shown. */
function sessionContext(onCards: (cards: readonly PanelCard[]) => void): PanelContext {
  const values = new Map<string, string>();
  const cards = new Map<string, PanelCard>();
  return {
    get: (key) => values.get(key),
    set: (key, value) => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
    show: (title, lines, summary) => {
      if (lines === undefined) cards.delete(title);
      else cards.set(title, { title, lines, ...(summary === undefined ? {} : { summary }) });
      onCards([...cards.values()]);
    },
  };
}

/**
 * The panel's session: while a `/word` is typed, the commands that start with it show under the field, ↑ and ↓ move
 * the highlight over the ones that can run, Tab puts the highlighted one in the field, a click runs one, and Esc hides
 * them; Enter runs the command named whole, else the highlighted one. A command that cannot run says why. Anything
 * else is said. The cards the commands show go in the header.
 */
export function panelSession(container: Container, panel: ChatPanel, commands: readonly PanelCommand[]): void {
  const context = sessionContext((cards) => {
    panel.cards(cards);
  });
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
    if (shown.length === 0) return false;
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
    panel.say(text);
    const word = text.startsWith('/') ? text.slice(1).trim() : undefined;
    const choice = highlighted;
    highlighted = 0;
    filter = undefined;
    if (word === undefined) return;
    const found = matching(word);
    const command = commands.find((each) => each.name === word) ?? found[Math.min(choice, found.length - 1)];
    if (command === undefined) {
      panel.answer(unknownCommand(word));
      return;
    }
    void run(command);
  });
}
