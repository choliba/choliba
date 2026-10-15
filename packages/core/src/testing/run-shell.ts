import type { Platform } from '../platform';
import { createShell, PLATFORM, type ShellModule, type Token, WORKSPACE_ROOT } from '../shell';
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
  const shell = createShell(platform, modules, [envSource(platform.env), fileSource(join(platform.cwd, '.env'))]);
  for (const override of overrides) {
    override.apply(shell.container);
  }
  return shell.run();
}

/**
 * A root with the verbs the app's packages register their commands under (`run`, `new`, `list`), for a spec that runs
 * a package's commands without the app: `runShell([coreShell, projectsShell, VERBS_ROOT], platform)`.
 */
export const VERBS_ROOT: ShellModule = {
  name: 'verbs-root',
  provide: (container) => {
    container.provide(WORKSPACE_ROOT, (current) => current.get(PLATFORM).cwd);
  },
  root: {
    spec: { usage: 'choliba COMMAND [ARGS]' },
    version: () => 'choliba 0.0.0',
    verbs: [
      { name: 'run', description: 'Roda' },
      { name: 'new', description: 'Cria' },
      { name: 'list', description: 'Lista' },
      { name: 'set', description: 'Define' },
    ],
  },
  commands: [],
};
import { join } from 'node:path';

import { envSource, fileSource } from '@choliba/config';
