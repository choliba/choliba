/** A key of the container, typed with what it gives back, so `get` needs no cast at the call site. */
export interface Token<T> {
  readonly name: string;
  /** Never set: it only carries `T`. */
  readonly type?: T;
}

/** A new token; `name` shows up in the container's errors. Tokens are compared by identity, not by name. */
export function token<T>(name: string): Token<T> {
  return { name };
}

/** Builds what a token gives, getting its own dependencies from the container. */
export type Factory<T> = (container: Container) => T;

/**
 * What the shell is built from, without decorators or reflection: each package registers a factory per token, and a
 * value is built the first time something asks for it, then reused. Only the command that runs builds what it needs.
 */
export class Container {
  private readonly factories = new Map<Token<unknown>, Factory<unknown>>();
  private readonly instances = new Map<Token<unknown>, unknown>();
  private readonly resolving: Token<unknown>[] = [];

  /** Registers how to build `key`. A token is registered once: two packages giving the same one is a bug. */
  provide<T>(key: Token<T>, factory: Factory<T>): void {
    if (this.factories.has(key)) {
      throw new Error(`${key.name} já está registrado no container.`);
    }
    this.factories.set(key, factory);
  }

  /**
   * Makes `key` give `value`, registered or not, whatever its factory would build: how a spec puts a fake in place of
   * a service.
   */
  override<T>(key: Token<T>, value: T): void {
    this.instances.set(key, value);
  }

  /** What `key` gives, built on the first call. */
  get<T>(key: Token<T>): T {
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }
    const factory = this.factories.get(key);
    if (factory === undefined) {
      throw new Error(`nada registrado no container para ${key.name}.`);
    }
    if (this.resolving.includes(key)) {
      const cycle = [...this.resolving, key].map((each) => each.name).join(' → ');
      throw new Error(`dependência circular no container: ${cycle}.`);
    }
    this.resolving.push(key);
    try {
      const value = factory(this);
      this.instances.set(key, value);
      return value as T;
    } finally {
      this.resolving.pop();
    }
  }
}
