import { paintAnsi, type AnsiColor } from '../../theme';
import { truncateVisible, visibleWidth } from '../frame';
import type { PanelBox, PanelScroll, PanelText, PanelToolkit } from './interfaces/panel.interface';
import { halfBlockArt, type ArtCell, type ArtPixels } from './panel-art';
import { PALETTE } from './panel-palette';
import { wrappedRows } from './panel-text';

/** The welcome image's rows: two pixels each, so a picture reads in half blocks; its width follows its proportions. */
const SPLASH_IMAGE_ROWS = 15;

/** How many rows the welcome image is drawn above its place, so it rises without moving the lines under it. */
const SPLASH_IMAGE_LIFT = 3;

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
  /** Stops the spinners: the panel is closing. */
  stop(): void;
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
}

/** How long a card's work has run, as its state line says it: `0m41s`, `12m05s`. */
export function cardElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60))}m${String(seconds % 60).padStart(2, '0')}s`;
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

/** What joins a card to the one before it, in gray, on its second row. */
const JOINT = '>>>';

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

/** A card line that is a rule across the card, in gray: what separates its parts. */
export const CARD_RULE = '---';

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
    /** The `>>>` before it, shown when it is `joined`. */
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
      zIndex: 2,
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
    // A click on a card opens or collapses that card alone.
    card.onMouseDown = () => {
      toggleCard(title);
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
    // Over the left border, between its corners, in the slot: the card's own border has one color.
    const stripe = new kit.TextRenderable(renderer, {
      content: '',
      wrapMode: 'none',
      position: 'absolute',
      top: 1,
      left: 0,
      width: 1,
      zIndex: 3,
    });
    stripe.visible = false;
    slot.add(stripe);
    const joint = new kit.TextRenderable(renderer, {
      content: styled(['', `\u001b[90m${JOINT}\u001b[39m`]),
      wrapMode: 'none',
      height: 2,
    });
    joint.visible = false;
    box.add(joint);
    box.add(slot);
    const built = { slot, box: card, rows, spinner, footer, footerRows: [], stripe, joint };
    made.set(title, built);
    return built;
  };
  // Every card comes in collapsed; the ones opened with their key or a click are kept here.
  const expanded = new Set<string>();
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
        (each.joined === true ? JOINT.length + HEADER_GAP : 0),
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
        const row = new kit.TextRenderable(renderer, { content: '', wrapMode: 'word', height: 1 });
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
        const row = new kit.TextRenderable(renderer, { content: '', wrapMode: 'none', height: 1 });
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
      card.box.height = folded ? COLLAPSED_HEIGHT : CARD_HEIGHT;
      const stripe = each.stripe;
      card.stripe.visible = stripe !== undefined;
      const inside = card.box.height - 2;
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
  return { box, heading, cards, toggleKey, stop };
}
