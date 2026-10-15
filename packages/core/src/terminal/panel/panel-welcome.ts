import type { PanelBox, PanelToolkit } from './interfaces/panel.interface';
import { halfBlockArt, type ArtCell, type ArtPixels } from './panel-art';
import { PALETTE } from './panel-palette';

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

/** The header row: the icon, then the lines beside it, with a blank row under both. */
export function headerBox<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  welcome: WelcomeKit<Context, Node, Styled, Chunk>,
  header: PanelHeader,
): Node & PanelBox<Node> {
  const { kit, renderer, styled } = welcome;
  const box = new kit.BoxRenderable(renderer, { flexDirection: 'row', gap: 2, paddingLeft: 1, paddingBottom: 1 });
  if (header.icon !== undefined) box.add(artBox(welcome, halfBlockArt(header.icon), 0));
  const lines = new kit.BoxRenderable(renderer, { flexDirection: 'column' });
  for (const line of header.lines)
    lines.add(new kit.TextRenderable(renderer, { content: styled([line]), wrapMode: 'word' }));
  box.add(lines);
  return box;
}
