import type { Writable, WritableWithColumns } from './writable';

/** The width a footer is drawn in when the terminal does not say its own. */
export const DEFAULT_COLUMNS = 80;

/**
 * Lines that stay at the bottom of a terminal while other lines are printed above them, the way the Playwright
 * reporter keeps its live tests (`LiveRegion`): every line printed through it first erases the footer, then the footer
 * is drawn again under it. Only for a terminal: whoever creates one has checked that `out` is a TTY.
 */
export class StatusFooter {
  private drawn = 0;

  constructor(
    private readonly out: WritableWithColumns,
    private readonly lines: (width: number) => readonly string[],
  ) {}

  /** A stream whose lines go above the footer: `out` itself, or the other stream of the same terminal (stderr). */
  writer(stream: Writable): Writable {
    return {
      write: (text) => {
        this.erase();
        stream.write(text);
        this.draw();
      },
    };
  }

  /** Draws the footer again, as it is now (a clock moved, the terminal was resized). */
  draw(): void {
    this.erase();
    const lines = this.lines(this.out.columns ?? DEFAULT_COLUMNS);
    if (lines.length === 0) return;
    this.out.write(`${lines.join('\n')}\n`);
    this.drawn = lines.length;
  }

  /** Erases the footer for good: what comes next is printed where it was. */
  close(): void {
    this.erase();
  }

  private erase(): void {
    if (this.drawn === 0) return;
    this.out.write(`\x1B[${String(this.drawn)}A\x1B[0J`);
    this.drawn = 0;
  }
}

/** `ms` as `hh:mm:ss`, the hours growing past 99 if they must. */
export function formatElapsed(ms: number): string {
  const seconds = Math.max(Math.floor(ms / 1000), 0);
  const parts = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}
