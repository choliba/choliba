/**
 * Fixed-capacity ring buffer. Used to keep the last N lines per session in memory
 * so a late subscriber (a future WebSocket client, for instance) can replay recent
 * history instead of joining a session's stream with no context.
 */
export class CircularBuffer<T> {
  private readonly items: T[] = [];
  private start = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`capacity must be a positive integer, got ${String(capacity)}`);
    }
  }

  push(item: T): void {
    if (this.items.length < this.capacity) {
      this.items.push(item);
      return;
    }
    this.items[this.start] = item;
    this.start = (this.start + 1) % this.capacity;
  }

  /** Chronological order, oldest first — the order a late subscriber should replay in. */
  toArray(): readonly T[] {
    if (this.items.length < this.capacity) {
      return [...this.items];
    }
    return [...this.items.slice(this.start), ...this.items.slice(0, this.start)];
  }

  get size(): number {
    return this.items.length;
  }
}
