import { pixelMap, type ArtColor } from '@choliba/tui';
import { type ArtPixels } from '@choliba/shell';

/** The owl's colors: its green, the white and orange of its eyes and beak, and the black of its pupils. */
const OWL_COLORS: Readonly<Record<string, ArtColor>> = {
  G: [0x1d, 0x45, 0x3c, 255],
  W: [0xf2, 0xec, 0xe0, 255],
  O: [0xe0, 0xa0, 0x20, 255],
  B: [0x12, 0x12, 0x12, 255],
};

/** choliba's owl drawn pixel by pixel for the panel's header: ears, eyes ringed in white and orange, and the beak. */
export const OWL_ICON: ArtPixels = pixelMap(
  ['...G..G...', '..GGGGGG..', '.GWWGGWWG.', 'GWOBWWBOWG', 'GWOOWWOOWG', '.GWWGGWWG.', '..GGWWGG..', '...GOOG...'],
  OWL_COLORS,
);
