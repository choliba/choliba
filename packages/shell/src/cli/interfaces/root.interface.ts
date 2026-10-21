import type { RootLayout, RootSpec } from '../../help';

/**
 * What an app says about its root: its spec without the commands (they register themselves), its version line, and how
 * the help lays out the commands.
 */
export interface RootOptions extends RootLayout {
  readonly spec: RootSpec;
  /** The line `--version` prints, as `choliba 0.0.1-dev.16+1a2b3c4`. */
  readonly version: () => string;
  /**
   * Called before the local `__complete`. A string is printed as the answer (including the files marker);
   * `undefined` completes from this CLI's spec.
   */
  readonly delegateComplete?: (words: readonly string[]) => string | undefined;
}
