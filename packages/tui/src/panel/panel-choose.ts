import { type PanelChoice, type PanelChooseRequest, type PanelKey } from '@choliba/shell';
import type { PanelBox, PanelText, PanelToolkit } from './interfaces/panel.interface';
import { wrapWords } from './panel-text';

/** The chooser of a panel: its box, how a choice is asked in it, and the keys it takes while one is open. */
export interface Chooser<Node> {
  readonly box: Node & PanelBox<Node>;
  /** Shows the request; gives the index chosen with Enter, or nothing on Esc. One at a time. */
  open(request: PanelChooseRequest): Promise<number | undefined>;
  /** Esc cancels and a digit moves to that option, while a choice is open. `true` when the key was the chooser's. */
  key(key: PanelKey): boolean;
  readonly isOpen: boolean;
}

/** How many options show at once; the window follows the highlight through longer lists. */
const MAX_VISIBLE_OPTIONS = 8;

const HINTS = '\u001b[90m↑↓ ou Tab move · Enter escolhe · clique escolhe · Esc cancela\u001b[39m';

/**
 * The option as the list shows it, in as many lines as its detail takes in `columns`: `❯` when highlighted, its number,
 * its label padded, `✔` when current, and its detail, wrapped under itself.
 */
function optionLines(
  choice: PanelChoice,
  index: number,
  width: number,
  highlighted: boolean,
  columns: number,
): string[] {
  const label = `${String(index + 1)}. ${choice.label.padEnd(width)}`;
  const check = choice.current === true ? '\u001b[32m✔\u001b[39m' : ' ';
  const head = highlighted ? `\u001b[1m❯ ${label}\u001b[22m ${check}` : `  ${label} ${check}`;
  if (choice.detail === undefined || choice.detail === '') return [head];
  // The detail starts after `❯ `, the label, ` ✔` and two spaces; the panel's left margin takes one more column.
  const indent = 2 + label.length + 2 + 2;
  // The highlighted option's detail lights up, so it reads as the arrows move; the others stay in gray.
  const gray = (text: string): string => (highlighted ? text : `\u001b[90m${text}\u001b[39m`);
  return wrapWords(choice.detail, Math.max(10, columns - indent - 1)).map((line, place) =>
    place === 0 ? `${head}  ${gray(line)}` : `${' '.repeat(indent)}${gray(line)}`,
  );
}

/**
 * A chooser in the style of a menu: the title in bold, the sentence under it, the numbered options and the keys,
 * between a line above and one below. Each option is a row of its own, so a click picks it. `onOpen` and `onClose` let
 * the panel hide its field while it is open.
 */
export function chooser<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  kit: PanelToolkit<Context, Node, Styled, Chunk>,
  renderer: Context,
  styled: (lines: readonly string[]) => Styled,
  around: { readonly onOpen: () => void; readonly onClose: () => void; readonly columns: () => number },
): Chooser<Node> {
  const box = new kit.BoxRenderable(renderer, {
    flexDirection: 'column',
    border: ['top', 'bottom'],
    paddingLeft: 1,
    flexShrink: 0,
  });
  // Every part has its rows: in the panel's column the lines' box takes all the room left, and would squeeze them.
  const row = (content: Styled | string): Node & PanelText<Styled> =>
    new kit.TextRenderable(renderer, { content, wrapMode: 'word', height: 1 });
  const title = row('');
  const description = row('');
  const rows = Array.from({ length: MAX_VISIBLE_OPTIONS }, () => row(''));
  box.add(title);
  box.add(description);
  box.add(row(''));
  rows.forEach((option) => {
    box.add(option);
  });
  box.add(row(''));
  box.add(row(styled([HINTS])));
  box.visible = false;
  let pending: ((index: number | undefined) => void) | undefined;
  let options: readonly PanelChoice[] = [];
  let highlighted = 0;
  let first = 0;

  const draw = (): void => {
    const width = Math.max(0, ...options.map((choice) => choice.label.length));
    first = Math.max(Math.min(first, highlighted), highlighted - MAX_VISIBLE_OPTIONS + 1);
    let height = 0;
    rows.forEach((option, place) => {
      const index = first + place;
      const choice = options[index];
      const lines =
        choice === undefined ? [] : optionLines(choice, index, width, index === highlighted, around.columns());
      option.visible = choice !== undefined;
      option.content = styled(lines);
      option.height = Math.max(1, lines.length);
      height += lines.length;
    });
    // The title, the sentence, a blank row, the options, a blank row and the keys, between the two lines.
    box.height = Math.max(1, height) + 7;
  };
  const close = (index: number | undefined): void => {
    const reply = pending;
    pending = undefined;
    box.visible = false;
    around.onClose();
    reply?.(index);
  };
  const move = (to: number): void => {
    highlighted = (to + options.length) % options.length;
    draw();
  };
  rows.forEach((option, place) => {
    option.onMouseDown = () => {
      if (pending !== undefined && first + place < options.length) close(first + place);
    };
  });

  return {
    box,
    get isOpen() {
      return pending !== undefined;
    },
    open: (request) =>
      new Promise((reply) => {
        pending = reply;
        options = request.options;
        highlighted = Math.max(
          0,
          options.findIndex((choice) => choice.current === true),
        );
        first = 0;
        title.content = styled([`\u001b[1m${request.title}\u001b[22m`]);
        description.content = styled([`\u001b[90m${request.description}\u001b[39m`]);
        draw();
        around.onOpen();
        box.visible = true;
      }),
    key: (key) => {
      if (pending === undefined) return false;
      if (key.name === 'escape') close(undefined);
      else if ((key.name === 'return' || key.name === 'kpenter') && options.length > 0) close(highlighted);
      else if (key.name === 'down' || key.name === 'tab') move(highlighted + 1);
      else if (key.name === 'up') move(highlighted - 1);
      else {
        const digit = Number(key.name);
        if (Number.isInteger(digit) && digit >= 1 && digit <= options.length) move(digit - 1);
      }
      // While a choice is open every key is the chooser's: the field is hidden.
      return true;
    },
  };
}
