import type { RootSpec } from '../../help';

/** What an app says about its root: its spec without the commands (they register themselves) and its version line. */
export interface RootOptions {
  readonly spec: RootSpec;
  /** The line `--version` prints, as `choliba 0.0.1-dev.16+1a2b3c4`. */
  readonly version: () => string;
  /**
   * The order of the root's sections (`['Commands', 'Agents']`): the registered entries are sorted by it, each
   * section keeping the order the app registers its commands in. Sections it does not name come last.
   */
  readonly groups?: readonly string[];
}

/**
 * What runs a first word that is not a command: `choliba <agent> …` is `choliba agents <agent> …`. Registered with
 * `@RegisterRootFallback()`; without one, such a word is a usage error.
 */
export interface RootFallback {
  /** Runs the whole command line and resolves to its exit code. */
  runUnknown(argv: readonly string[]): Promise<number>;
}
