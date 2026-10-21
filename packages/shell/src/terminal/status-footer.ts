import type { Writable, WritableWithColumns } from './writable';

/** The width a footer is drawn in when the terminal does not say its own. */
export const DEFAULT_COLUMNS = 80;

/** Hides and shows the cursor, so it does not blink under the footer. */
const HIDE_CURSOR = '\x1B[?25l';
const SHOW_CURSOR = '\x1B[?25h';
/**
 * A synchronized update: the terminal shows what comes between the two at once, so a redraw does not flicker.
 * Terminals that do not know it ignore both.
 */
const SYNC_BEGIN = '\x1B[?2026h';
const SYNC_END = '\x1B[?2026l';

/**
 * Lines that stay at the bottom of a terminal while other lines are printed above them, the way the Playwright
 * reporter keeps its live tests (`LiveRegion`): every line printed through it first erases the footer, then the footer
 * is drawn again under it. The cursor is hidden while the footer is up. Only for a terminal: whoever creates one has
 * checked that `out` is a TTY.
 */
export class StatusFooter {
  private drawn = 0;
  private cursorHidden = false;

  constructor(
    private readonly out: WritableWithColumns,
    private readonly lines: (width: number) => readonly string[],
  ) {}

  /** A stream whose lines go above the footer: `out` itself, or the other stream of the same terminal (stderr). */
  writer(stream: Writable): Writable {
    return {
      write: (text) => {
        this.out.write(`${SYNC_BEGIN}${this.erased()}`);
        stream.write(text);
        this.out.write(`${this.painted()}${SYNC_END}`);
      },
    };
  }

  /** Draws the footer again, as it is now (a clock moved, the terminal was resized). */
  draw(): void {
    this.out.write(`${SYNC_BEGIN}${this.erased()}${this.painted()}${SYNC_END}`);
  }

  /** Erases the footer for good and gives the cursor back: what comes next is printed where it was. */
  close(): void {
    const cursor = this.cursorHidden ? SHOW_CURSOR : '';
    this.cursorHidden = false;
    const erased = this.erased();
    if (erased !== '' || cursor !== '') this.out.write(`${erased}${cursor}`);
  }

  /** The footer's lines, ready to write (the cursor hidden the first time); remembers how many to erase next. */
  private painted(): string {
    const lines = this.lines(this.out.columns ?? DEFAULT_COLUMNS);
    if (lines.length === 0) return '';
    const cursor = this.cursorHidden ? '' : HIDE_CURSOR;
    this.cursorHidden = true;
    this.drawn = lines.length;
    return `${cursor}${lines.join('\n')}\n`;
  }

  /** What erases the footer drawn last (nothing when none is), and forgets it. */
  private erased(): string {
    if (this.drawn === 0) return '';
    // `\r` first: something the terminal echoed (`^C`) may have moved the cursor off the first column.
    const erase = `\r\x1B[${String(this.drawn)}A\x1B[0J`;
    this.drawn = 0;
    return erase;
  }
}

/** `ms` as `hh:mm:ss.mmm`, the hours growing past 99 if they must. */
export function formatElapsed(ms: number): string {
  const total = Math.max(Math.floor(ms), 0);
  const seconds = Math.floor(total / 1000);
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  const clock = parts.map((part) => String(part).padStart(2, '0')).join(':');
  return `${clock}.${String(total % 1000).padStart(3, '0')}`;
}
