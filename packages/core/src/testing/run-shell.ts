import type { Platform } from '../platform';
import { createShell, type ShellModule, type Token } from '../shell';
import type { ShellOverride } from './interfaces/shell-override.interface';

/** Makes `key` give `value` in the shell `runShell` builds: the spec's fake in place of a package's service. */
export function replace<T>(key: Token<T>, value: T): ShellOverride {
  return {
    apply: (container) => {
      container.override(key, value);
    },
  };
}

/**
 * Runs `platform.argv` as a command line against the shell of `modules` (the packages under test), the way `main.ts`
 * does, and resolves with the exit code the command set.
 */
export function runShell(
  modules: readonly ShellModule[],
  platform: Platform,
  overrides: readonly ShellOverride[] = [],
): Promise<number> {
  const shell = createShell(platform, modules);
  for (const override of overrides) {
    override.apply(shell.container);
  }
  return shell.run();
}
