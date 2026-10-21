export type Listener<T> = (payload: T) => void;

/**
 * A minimal typed pub/sub, deliberately not built on node:events: that emitter types
 * `on`/`emit` with `...args: any[]`, which would need unsafe casts under this repo's
 * strictTypeChecked lint config. A Map-of-Sets needs none.
 */
type UnknownListener = (payload: unknown) => void;

export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents & string, Set<UnknownListener>>();

  on<K extends keyof TEvents & string>(event: K, listener: Listener<TEvents[K]>): () => void {
    const set = this.listeners.get(event) ?? new Set<UnknownListener>();
    const wrapped = listener as unknown as UnknownListener;
    set.add(wrapped);
    this.listeners.set(event, set);
    return () => {
      set.delete(wrapped);
    };
  }

  emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(payload);
    }
  }
}
