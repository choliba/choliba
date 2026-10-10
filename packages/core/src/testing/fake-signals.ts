import type { SignalSource } from '../platform';

/** Signals a spec can send (`emit`) to whatever subscribed. */
export class FakeSignals implements SignalSource {
  private readonly listeners = new Map<NodeJS.Signals, Set<() => void>>();

  on(event: NodeJS.Signals, listener: () => void): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }

  off(event: NodeJS.Signals, listener: () => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: NodeJS.Signals): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener();
    }
  }

  count(event: NodeJS.Signals): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
