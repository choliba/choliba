import { type ArtPixels } from '@choliba/shell';
/** One cell of a picture in half blocks: its character, and the colors (`#rrggbb`) it is drawn with. */
export interface ArtCell {
  readonly text: string;
  readonly fg?: string;
  readonly bg?: string;
}

/** Below this alpha a pixel is not drawn, so the terminal's own background shows there. */
const OPAQUE_FROM = 128;

/** The color of the pixel at `x`, `y`, or nothing where it is transparent or past the picture. */
function colorAt(pixels: ArtPixels, x: number, y: number): string | undefined {
  if (y < 0 || y >= pixels.height) return undefined;
  const rgba = new DataView(pixels.data.buffer, pixels.data.byteOffset).getUint32(y * pixels.stride + x * 4);
  if ((rgba & 0xff) < OPAQUE_FROM) return undefined;
  return `#${(rgba >>> 8).toString(16).padStart(6, '0')}`;
}

/** The cell of two pixels, one above the other: the upper half block takes the top one, the background the bottom. */
function cell(top: string | undefined, bottom: string | undefined): ArtCell {
  if (top === undefined) return bottom === undefined ? { text: ' ' } : { text: '▄', fg: bottom };
  if (bottom === undefined) return { text: '▀', fg: top };
  return { text: '▀', fg: top, bg: bottom };
}

/**
 * A picture as rows of cells, two pixels per cell, one above the other (`▀`, `▄`): each row of cells is two rows of
 * pixels. A transparent pixel gets no color, so it shows the terminal's background instead of black. `halfRowDown`
 * starts it half a row lower, from the middle of its first cell, where a border drawn in that row runs.
 */
export function halfBlockArt(pixels: ArtPixels, halfRowDown = false): ArtCell[][] {
  const rows: ArtCell[][] = [];
  for (let y = halfRowDown ? -1 : 0; y < pixels.height; y += 2) {
    const row: ArtCell[] = [];
    for (let x = 0; x < pixels.width; x += 1) row.push(cell(colorAt(pixels, x, y), colorAt(pixels, x, y + 1)));
    rows.push(row);
  }
  return rows;
}

/** A pixel's color, `[r, g, b, a]`, each 0 to 255. */
export type ArtColor = readonly [number, number, number, number];

/**
 * Pixels drawn by hand: one string per row, one character per pixel, each named in `colors`. A character `colors`
 * does not name, or a row shorter than the first, is transparent.
 */
export function pixelMap(rows: readonly string[], colors: Readonly<Record<string, ArtColor>>): ArtPixels {
  const width = rows[0]?.length ?? 0;
  const data = new Uint8Array(width * rows.length * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const color = colors[row.charAt(x)];
      if (color !== undefined) data.set(color, (y * width + x) * 4);
    }
  });
  return { data, width, height: rows.length, stride: width * 4 };
}
