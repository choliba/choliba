import {
  CARD_RULE,
  cardElapsed,
  paintAnsi,
  truncateVisible,
  visibleWidth,
  type PanelCard,
  type PanelHeader,
  type PanelSplash,
} from '@choliba/shell';

import type { PanelBox, PanelPointer, PanelScroll, PanelText, PanelToolkit } from './interfaces/panel.interface';
import { halfBlockArt, type ArtCell } from './panel-art';
import { PALETTE } from './panel-palette';
import { wrappedRows } from './panel-text';

/** The welcome image's rows: two pixels each, so a picture reads in half blocks; its width follows its proportions. */
const SPLASH_IMAGE_ROWS = 15;

/** How many rows the welcome image is drawn above its place, so it rises without moving the lines under it. */
const SPLASH_IMAGE_LIFT = 3;

/** The panel's toolkit and renderer, and how it turns lines with escape codes into its styled text. */
export interface WelcomeKit<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk> {
  readonly kit: PanelToolkit<Context, Node, Styled, Chunk>;
  readonly renderer: Context;
  readonly styled: (lines: readonly string[]) => Styled;
}

/** `source` as half-block rows, `rows` tall at its own proportions; nothing when it does not load. */
async function imageArt<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  kit: PanelToolkit<Context, Node, Styled, Chunk>,
  source: string | undefined,
  rows: number,
): Promise<ArtCell[][] | undefined> {
  if (source === undefined) return undefined;
  try {
    const image = await kit.NativeImage.load(source);
    const height = rows * 2;
    const width = Math.max(1, Math.round((height * image.width) / image.height));
    const small = image.resize({ width, height, kernel: 'area' });
    image.dispose();
    const art = halfBlockArt(small.raw('rgba8'));
    small.dispose();
    return art;
  } catch {
    return undefined;
  }
}

/** A column of the art's rows, each cell in its colors, and the terminal's background where it has none. */
function artBox<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  { kit, renderer }: WelcomeKit<Context, Node, Styled, Chunk>,
  art: ArtCell[][],
  lift: number,
): Node & PanelBox<Node> {
  const picture = new kit.BoxRenderable(renderer, { flexDirection: 'column', position: 'relative', top: -lift });
  const chunks = (cell: ArtCell): Chunk[] => {
    const drawn = cell.fg === undefined ? kit.stringToStyledText(cell.text).chunks : [kit.fg(cell.fg)(cell.text)];
    const background = cell.bg;
    return background === undefined ? drawn : drawn.map((chunk) => kit.bg(background)(chunk));
  };
  for (const row of art) {
    picture.add(
      new kit.TextRenderable(renderer, { content: new kit.StyledText(row.flatMap(chunks)), wrapMode: 'word' }),
    );
  }
  return picture;
}

/**
 * The welcome over the panel, centered and above it (`zIndex`), so it takes no row of the layout: the image's rows,
 * raised a little, then each line, and the note in a corner.
 */
export async function splashBox<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  welcome: WelcomeKit<Context, Node, Styled, Chunk>,
  splash: PanelSplash,
): Promise<Node & PanelBox<Node>> {
  const { kit, renderer, styled } = welcome;
  const box = new kit.BoxRenderable(renderer, {
    flexDirection: 'column',
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  });
  const art = await imageArt(kit, splash.image, SPLASH_IMAGE_ROWS);
  if (art !== undefined) box.add(artBox(welcome, art, SPLASH_IMAGE_LIFT));
  // An empty line keeps its row, so a blank between two lines is a margin.
  for (const line of splash.lines) {
    box.add(
      new kit.TextRenderable(renderer, {
        content: styled([line]),
        wrapMode: 'word',
        ...(line === '' ? { height: 1 } : {}),
      }),
    );
  }
  if (splash.note !== undefined) {
    box.add(
      new kit.TextRenderable(renderer, {
        content: new kit.StyledText([kit.fg(PALETTE.white)(splash.note)]),
        wrapMode: 'word',
        position: 'absolute',
        bottom: 0,
        right: 1,
      }),
    );
  }
  return box;
}

/** The header: its row, and how its lines are replaced. */
export interface Header<Node> {
  readonly box: Node & PanelBox<Node>;
  /** Replaces the lines beside the icon, with their escape codes. */
  heading(lines: readonly string[]): void;
  /** Shows these cards on the right of the lines, in their order; a card no longer given is hidden. */
  cards(cards: readonly PanelCard[]): void;
  /** Opens or collapses the card whose key is `key` (Ctrl+`key`): `true` when a card has it. Open at first. */
  toggleKey(key: string): boolean;
  /** Called when a card that can move is dropped on another that can: it takes that one's place. */
  onMove(listener: (title: string, onto: string) => void): void;
  /** Stops the spinners: the panel is closing. */
  stop(): void;
}

/** How many cells the bar of a busy card's spinner has. */
const SPINNER_CELLS = 5;

/** How many frames a busy card's spinner has, one every `SPIN_MS`: its block runs along the bar, there and back. */
const SPINNER_FRAMES = 2 * SPINNER_CELLS - 2;

/** The bar of the spinner in frame `step`. */
function spinnerBar(step: number): string {
  const place = step < SPINNER_CELLS ? step : SPINNER_FRAMES - step;
  return '▱'.repeat(place) + '▰' + '▱'.repeat(SPINNER_CELLS - 1 - place);
}
const SPIN_MS = 120;

/** A card's title on its border: its marker, its name, its shortcut (`^P`), and room for the spinner while busy. */
function cardTitle(marker: string, card: PanelCard, busy: boolean): string {
  const shortcut = card.key === undefined ? '' : ` ^${card.key.toUpperCase()}`;
  return ` ${marker} ${card.title}${shortcut} ${busy ? `${' '.repeat(SPINNER_CELLS)} ` : ''}`;
}

/** A card's width, in columns, its border included. */
const CARD_WIDTH = 44;

/** The narrowest a card that says its state gets when the header lacks room. */
const CARD_MIN_WIDTH = 20;

/** The columns of text a card `width` wide has: its width less the borders, the margins inside them and the scroll bar. */
function textWidth(width: number): number {
  return width - 5;
}

/** What joins a card to the one before it, in gray, on its second row: an arrow from one border to the other. */
const JOINT = '──────▶';

/** The columns the arrow takes of the header's gaps on each side of it, so it touches both borders. */
const JOINT_OVERLAP = 2;

/** The header's gap between two of its parts. */
const HEADER_GAP = 2;

/** `line` centered in `width` columns. */
function centered(line: string, width: number): string {
  return `${' '.repeat(Math.max(0, Math.floor((width - visibleWidth(line)) / 2)))}${line}`;
}

/** The first line of a card that says its state: the state, or while busy the spinner's bar and how long it has run. */
function stateLine(card: PanelCard, frame: number, now: number): string | undefined {
  if (card.state === undefined) return undefined;
  if (card.busy !== true) return card.state;
  const bar = paintAnsi(card.color ?? 'white', spinnerBar(frame));
  return `${bar} ${cardElapsed(now - (card.since ?? now))}`;
}

/** A rule across `width` columns of a card's text, in gray. */
function ruleOf(width: number): string {
  return `\u001b[90m${'─'.repeat(width)}\u001b[39m`;
}

/**
 * Every open card's rows, its border included: all cards stand as tall, and what does not fit scrolls inside one. A
 * collapsed card is its border and three lines of its summary, each cut with `…` to the card's width so it never
 * wraps: five rows, whose borders run through the middle of the first and the last, where the icon, half a row
 * lower, begins and ends.
 */
const CARD_HEIGHT = 10;
const COLLAPSED_LINES = 3;
const COLLAPSED_HEIGHT = COLLAPSED_LINES + 2;

/** The cards' border: a dim gray, so their lines read before it. */
const CARD_BORDER = PALETTE.gray;

/** The border of a card dragged with the mouse, and of the card it would drop on. */
const DRAGGED_BORDER = PALETTE['bright-yellow'];
const AIMED_BORDER = PALETTE.white;

/** A card over its slot; the slot of a card dragged, over the other cards. */
const CARD_Z = 2;
const DRAGGED_Z = 1;

/**
 * Behind a card, so an open one covers the conversation under it: the background of the dark theme `PALETTE` comes
 * from.
 */
const CARD_BACKGROUND = '#1e1e1e';

/** The header row: the icon, then the lines beside it, with a blank row under both. */
export function headerBox<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  welcome: WelcomeKit<Context, Node, Styled, Chunk>,
  header: PanelHeader,
  columns: () => number,
): Header<Node> {
  const { kit, renderer, styled } = welcome;
  const box = new kit.BoxRenderable(renderer, {
    flexDirection: 'row',
    gap: 2,
    paddingLeft: 1,
    paddingBottom: 1,
    flexShrink: 0,
    // Drawn after the conversation under it, so an open card covers it.
    zIndex: 1,
  });
  // Half a row lower, the icon starts and ends where the collapsed cards' borders run, in the middle of a row.
  const icon = header.icon === undefined ? undefined : halfBlockArt(header.icon, true);
  if (icon !== undefined) box.add(artBox(welcome, icon, 0));
  // What the icon and the lines take of the header's width, its padding and their gaps included.
  const iconWidth = icon === undefined ? 0 : Math.max(0, ...icon.map((row) => row.length)) + HEADER_GAP;
  let headingWidth = 0;
  const column = new kit.BoxRenderable(renderer, { flexDirection: 'column' });
  box.add(column);
  // A line no longer given keeps its row, empty, so the header does not jump.
  const rows: PanelText<Styled>[] = [];
  const heading = (lines: readonly string[]): void => {
    headingWidth = Math.max(0, ...lines.map(visibleWidth));
    lines.forEach((line, index) => {
      const row = rows[index];
      if (row !== undefined) {
        row.content = styled([line]);
        return;
      }
      const added = new kit.TextRenderable(renderer, { content: styled([line]), wrapMode: 'word', height: 1 });
      rows.push(added);
      column.add(added);
    });
    rows.slice(lines.length).forEach((row) => {
      row.content = '';
    });
  };
  heading(header.lines);
  // A card is made the first time its title shows, then only filled or hidden: the header keeps its order.
  interface Card {
    /** Its place in the header, as tall as a collapsed card: opening the card does not move what is under it. */
    readonly slot: Node & PanelBox<Node>;
    readonly box: Node & PanelScroll<Node>;
    readonly rows: PanelText<Styled>[];
    readonly spinner: PanelText<Styled>;
    /** Its footer, under the lines that scroll, and the footer's rows: a rule, then its lines. */
    readonly footer: Node & PanelBox<Node>;
    readonly footerRows: PanelText<Styled>[];
    /** Its left border in its `stripe` color, drawn over the gray one. */
    readonly stripe: PanelText<Styled>;
    /** Its width, as the cards were last shown. */
    width: number;
    /** The arrow before it, shown when it is `joined`. */
    readonly joint: Node & PanelText<Styled>;
  }
  const made = new Map<string, Card>();
  const cardOf = (shown: PanelCard): Card => {
    const { title } = shown;
    const known = made.get(title);
    if (known !== undefined) return known;
    const card = new kit.ScrollBoxRenderable(renderer, {
      flexGrow: 0,
      border: true,
      title: ` ${title} `,
      titleColor: PALETTE.white,
      borderColor: CARD_BORDER,
      stickyScroll: false,
      scrollX: false,
      width: CARD_WIDTH,
      paddingLeft: 1,
      paddingRight: 1,
      flexShrink: 0,
      // Over its slot: open, it grows down over the conversation instead of pushing it.
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: CARD_Z,
      backgroundColor: CARD_BACKGROUND,
    });
    const slot = new kit.BoxRenderable(renderer, {
      flexDirection: 'column',
      width: CARD_WIDTH,
      height: COLLAPSED_HEIGHT,
      flexShrink: 0,
    });
    slot.add(card);
    const rows: PanelText<Styled>[] = [];
    // A click on a card opens or collapses that card alone, as the mouse is let go. A card that can move, dragged,
    // follows the mouse over the others, its border lit, and the card under the mouse lit too: let go there, it takes
    // that card's place.
    card.onMouseDown = (event: PanelPointer) => {
      pressed = { title, from: event.x, slotFrom: slot.x, dragged: false };
    };
    card.onMouseDrag = (event: PanelPointer) => {
      if (pressed?.title !== title) return;
      pressed = { ...pressed, dragged: true };
      if (!movable(title)) return;
      card.translateX = event.x - pressed.from - (slot.x - pressed.slotFrom);
      slot.zIndex = DRAGGED_Z;
      card.borderColor = DRAGGED_BORDER;
      aim(cardAt(event.x, title));
    };
    card.onMouseUp = (event: PanelPointer) => {
      if (pressed?.title !== title) return;
      const { dragged } = pressed;
      pressed = undefined;
      card.translateX = 0;
      slot.zIndex = 0;
      card.borderColor = CARD_BORDER;
      aim(undefined);
      if (!dragged) {
        toggleCard(title);
        return;
      }
      const onto = movable(title) ? cardAt(event.x, title) : undefined;
      if (onto !== undefined) for (const listener of moves) listener(title, onto);
    };
    // The spinner is drawn over the top border, in the room its title leaves after the name: a title has one color.
    const spinner = new kit.TextRenderable(renderer, {
      content: '',
      wrapMode: 'none',
      position: 'absolute',
      top: -1,
      left: cardTitle('▾', shown, false).trimEnd().length + 2,
      width: SPINNER_CELLS,
      height: 1,
      zIndex: 1,
    });
    spinner.visible = false;
    card.wrapper.add(spinner);
    // On the wrapper, under the lines that scroll: the footer stays at the bottom of the open card.
    const footer = new kit.BoxRenderable(renderer, { flexDirection: 'column', flexShrink: 0, paddingLeft: 1 });
    footer.visible = false;
    card.wrapper.add(footer);
    // Over the left border, between its corners, on the wrapper as the spinner: the card's own border has one color.
    const stripe = new kit.TextRenderable(renderer, {
      content: '',
      wrapMode: 'none',
      position: 'absolute',
      top: 0,
      left: -1,
      width: 1,
      zIndex: 1,
    });
    stripe.visible = false;
    card.wrapper.add(stripe);
    const joint = new kit.TextRenderable(renderer, {
      content: styled(['', `\u001b[90m${JOINT}\u001b[39m`]),
      wrapMode: 'none',
      width: JOINT.length,
      marginLeft: -JOINT_OVERLAP,
      marginRight: -JOINT_OVERLAP,
      height: 2,
    });
    joint.visible = false;
    box.add(joint);
    box.add(slot);
    const built = { slot, box: card, rows, spinner, footer, footerRows: [], stripe, joint, width: CARD_WIDTH };
    made.set(title, built);
    return built;
  };
  // Every card comes in collapsed; the ones opened with their key or a click are kept here.
  const expanded = new Set<string>();
  // The card pressed with the mouse: where, where its slot was then, and whether it was dragged since; the card a drag
  // would drop on, lit; who hears of a card moved.
  let pressed:
    { readonly title: string; readonly from: number; readonly slotFrom: number; readonly dragged: boolean } | undefined;
  let aimed: string | undefined;
  const moves: ((title: string, onto: string) => void)[] = [];
  const movable = (title: string): boolean => current.some((each) => each.title === title && each.movable === true);
  /** The card that can move under the column `x`, other than `dragged`. */
  const cardAt = (x: number, dragged: string): string | undefined =>
    current.find(({ title }) => {
      const card = made.get(title);
      return (
        title !== dragged && movable(title) && card !== undefined && x >= card.slot.x && x < card.slot.x + card.width
      );
    })?.title;
  /** Lights the border of the card a drag would drop on, and puts out the one before. */
  const aim = (title: string | undefined): void => {
    if (aimed === title) return;
    const before = aimed === undefined ? undefined : made.get(aimed);
    if (before !== undefined) before.box.borderColor = CARD_BORDER;
    aimed = title;
    const lit = title === undefined ? undefined : made.get(title);
    if (lit !== undefined) lit.box.borderColor = AIMED_BORDER;
  };
  let current: readonly PanelCard[] = [];
  let frame = 0;
  let spinning: ReturnType<typeof setInterval> | undefined;
  const stop = (): void => {
    clearInterval(spinning);
    spinning = undefined;
  };
  // The spinner turns only while a card is busy: no timer runs for a header at rest.
  const spin = (busy: boolean): void => {
    if (!busy) stop();
    else
      spinning ??= setInterval(() => {
        frame = (frame + 1) % SPINNER_FRAMES;
        cards(current);
      }, SPIN_MS);
  };
  /**
   * The width of a card that says its state: the header's width, less the icon, the lines and the other cards, shared
   * among them, between the narrowest and a card's own width.
   */
  const flowWidth = (shown: readonly PanelCard[]): number => {
    const flowing = shown.filter((each) => each.state !== undefined).length;
    const taken = shown.reduce(
      (sum, each) =>
        sum +
        HEADER_GAP +
        (each.state === undefined ? CARD_WIDTH : 0) +
        (each.joined === true ? JOINT.length - 2 * JOINT_OVERLAP + HEADER_GAP : 0),
      1 + iconWidth + headingWidth,
    );
    const share = Math.floor((columns() - taken) / Math.max(1, flowing));
    return Math.min(CARD_WIDTH, Math.max(CARD_MIN_WIDTH, share));
  };
  const cards = (shown: readonly PanelCard[]): void => {
    current = shown;
    spin(shown.some((each) => each.busy === true));
    for (const [title, card] of made) {
      card.slot.visible = shown.some((each) => each.title === title);
      card.joint.visible = false;
    }
    const narrow = flowWidth(shown);
    const now = Date.now();
    for (const each of shown) {
      const card = cardOf(each);
      // Taken out and put back, each card goes after the ones before it: the header follows the order given.
      box.remove(card.joint);
      box.remove(card.slot);
      box.add(card.joint);
      box.add(card.slot);
      card.joint.visible = each.joined === true;
      const width = each.state === undefined ? CARD_WIDTH : narrow;
      const text = textWidth(width);
      card.slot.width = width;
      card.width = width;
      card.box.width = width;
      const folded = !expanded.has(each.title);
      const state = stateLine(each, frame, now);
      const head = state === undefined ? [] : [centered(truncateVisible(state, text), text)];
      const lines = folded
        ? [...head, ...(each.summary ?? [each.lines[0] ?? ''])]
            .slice(0, COLLAPSED_LINES)
            .map((line) => truncateVisible(line, text))
        : [...head, ...each.lines];
      // A card gets the rows its longest content asks for; what does not fit its height scrolls.
      while (card.rows.length < lines.length) {
        // Not selectable: pressed, a card's line starts a drag of the card, not a selection of its text.
        const row = new kit.TextRenderable(renderer, { content: '', wrapMode: 'word', height: 1, selectable: false });
        card.box.add(row);
        card.rows.push(row);
      }
      card.slot.visible = true;
      // A card that says its state turns its bar in its first line, not in its title.
      const busy = each.busy === true && state === undefined;
      card.box.title = truncateVisible(cardTitle(folded ? '▸' : '▾', each, busy), width - 4);
      card.spinner.visible = busy;
      card.spinner.content = busy ? styled([paintAnsi(each.color ?? 'white', spinnerBar(frame))]) : '';
      // A long line wraps between words in the card's width, its row as tall as the lines it takes.
      card.rows.forEach((row, index) => {
        const line = lines[index];
        row.visible = line !== undefined;
        row.content = line === undefined ? '' : styled([line === CARD_RULE ? ruleOf(text) : line]);
        row.height = line === undefined ? 1 : wrappedRows(line, text);
      });
      const footer = folded || each.footer === undefined ? [] : [CARD_RULE, ...each.footer];
      while (card.footerRows.length < footer.length) {
        const row = new kit.TextRenderable(renderer, { content: '', wrapMode: 'none', height: 1, selectable: false });
        card.footer.add(row);
        card.footerRows.push(row);
      }
      card.footer.visible = footer.length > 0;
      card.footerRows.forEach((row, index) => {
        const line = footer[index];
        row.visible = line !== undefined;
        row.content =
          line === undefined ? '' : styled([line === CARD_RULE ? ruleOf(text) : truncateVisible(line, text)]);
      });
      const height = folded ? COLLAPSED_HEIGHT : CARD_HEIGHT;
      card.box.height = height;
      const stripe = each.stripe;
      card.stripe.visible = stripe !== undefined;
      // From the height set, not read back: the toolkit gives the one of its last layout, none for a new card.
      const inside = height - 2;
      card.stripe.height = inside;
      card.stripe.content =
        stripe === undefined ? '' : styled(Array.from({ length: inside }, () => paintAnsi(stripe, '┃')));
    }
  };
  const toggleCard = (title: string): void => {
    if (!expanded.delete(title)) expanded.add(title);
    cards(current);
  };
  const toggleKey = (key: string): boolean => {
    const card = current.find((each) => each.key === key);
    if (card !== undefined) toggleCard(card.title);
    return card !== undefined;
  };
  const onMove = (listener: (title: string, onto: string) => void): void => {
    moves.push(listener);
  };
  return { box, heading, cards, toggleKey, onMove, stop };
}
