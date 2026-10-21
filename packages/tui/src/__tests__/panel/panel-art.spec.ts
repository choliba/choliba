import { halfBlockArt, pixelMap } from '../../panel/panel-art';

/** RGBA pixels of `rows`, each pixel `[r, g, b, a]`, with `padding` bytes at the end of every row. */
function pixels(rows: readonly (readonly (readonly number[])[])[], padding = 0) {
  const width = rows[0]?.length ?? 0;
  const stride = width * 4 + padding;
  const data = new Uint8Array(stride * rows.length);
  rows.forEach((row, y) => {
    row.forEach((pixel, x) => {
      data.set(pixel, y * stride + x * 4);
    });
  });
  return { data, width, height: rows.length, stride };
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [9, 9, 9, 0];
const FAINT = [255, 255, 255, 127];

describe('halfBlockArt', () => {
  it('draws two pixels per cell, the top one in front of the bottom one', () => {
    expect(halfBlockArt(pixels([[RED], [BLUE]]))).toEqual([[{ text: '▀', fg: '#ff0000', bg: '#0000ff' }]]);
  });

  it('leaves transparent and faint pixels without color, so the terminal shows through', () => {
    expect(
      halfBlockArt(
        pixels(
          [
            [RED, CLEAR, FAINT],
            [CLEAR, BLUE, CLEAR],
          ],
          4,
        ),
      ),
    ).toEqual([[{ text: '▀', fg: '#ff0000' }, { text: '▄', fg: '#0000ff' }, { text: ' ' }]]);
  });

  it('starts half a row lower when asked, its first cell taking the first pixel in its bottom half', () => {
    expect(halfBlockArt(pixels([[RED], [BLUE]]), true)).toEqual([
      [{ text: '▄', fg: '#ff0000' }],
      [{ text: '▀', fg: '#0000ff' }],
    ]);
  });

  it('draws an odd last row of pixels over nothing', () => {
    expect(halfBlockArt(pixels([[RED], [RED], [BLUE]]))).toEqual([
      [{ text: '▀', fg: '#ff0000', bg: '#ff0000' }],
      [{ text: '▀', fg: '#0000ff' }],
    ]);
  });
});

describe('pixelMap', () => {
  it('turns a map of letters into pixels, a letter with no color and a short row transparent', () => {
    const pixels = pixelMap(['R.', 'B'], { R: [255, 0, 0, 255], B: [0, 0, 255, 255] });

    expect(pixels).toMatchObject({ width: 2, height: 2, stride: 8 });
    expect([...pixels.data]).toEqual([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0]);
    expect(halfBlockArt(pixels)).toEqual([[{ text: '▀', fg: '#ff0000', bg: '#0000ff' }, { text: ' ' }]]);
  });

  it('has no pixels for no rows', () => {
    expect(pixelMap([], {})).toMatchObject({ width: 0, height: 0 });
  });
});
