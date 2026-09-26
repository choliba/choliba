import { formatDuration } from './format-duration';
import { defaultStdout, type WritableWithColumns } from './writable';

export const DEFAULT_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface LiveRow {
  id: string;
  text: string;
  since: number;
}

export class LiveRegion {
  private rows = new Map<string, LiveRow>();
  private currentFrame = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private drawnLines = 0;

  constructor(
    private readonly out: WritableWithColumns = defaultStdout,
    private readonly frames: string[] = DEFAULT_SPINNER_FRAMES,
    private readonly intervalMs = 150,
  ) {}

  set(row: LiveRow): void {
    this.rows.set(row.id, row);
    this.startSpinnerIfNeeded();
  }

  remove(id: string): void {
    this.rows.delete(id);
  }

  has(id: string): boolean {
    return this.rows.has(id);
  }

  printPermanent(text: string): void {
    this.clearDrawn();
    this.out.write(text);
    this.redraw();
  }

  redraw(): void {
    this.clearDrawn();
    const frame = this.frames[this.currentFrame] ?? '?';
    let lines = 0;
    for (const row of this.rows.values()) {
      const elapsed = formatDuration(Date.now() - row.since);
      const rowLines = row.text.split('\n');
      const head = rowLines.slice(0, 1).join('');
      const text = [`${frame} ${head} (${elapsed})`, ...rowLines.slice(1)].join('\n');
      this.out.write(`${text}\n`);
      lines += text.split('\n').length;
    }
    this.drawnLines = lines;
  }

  clearDrawn(): void {
    if (this.drawnLines === 0) return;
    this.out.write(`\x1B[${String(this.drawnLines)}A\x1B[0J`);
    this.drawnLines = 0;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.clearDrawn();
  }

  private startSpinnerIfNeeded(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.redraw();
    }, this.intervalMs);
    this.intervalId.unref();
  }
}
