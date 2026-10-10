import { agentsShell } from '@choliba/agents';
import {
  CONFIG,
  coreShell,
  createShell,
  PLATFORM,
  versionLine,
  type Platform,
  type Shell,
  type ShellModule,
} from '@choliba/core';
import { projectsShell } from '@choliba/projects';
import { runnerShell } from '@choliba/runner';
import { terminalShell } from '@choliba/terminal';

import { checkCommand } from './check';
import { CHOLIBA_ORDER, CHOLIBA_ROOT, cholibaManifest, PACKAGE_NAME } from './help';
import { RUNTIME, type Runtime } from './runtime';
import { setupCommand } from './setup';
import { formatCommand, lintCommand, TOOLS, ToolsService } from './tooling';

/**
 * The commands of the choliba app itself in the shell, on its `runtime`: `check`, `lint`, `format` and `setup`. The
 * app's last module, as only the app has a runtime.
 */
export function cholibaShell(runtime: Runtime): ShellModule {
  return {
    name: 'choliba',
    root: {
      spec: CHOLIBA_ROOT,
      version: () => versionLine(PACKAGE_NAME, cholibaManifest()),
      groups: ['Commands', 'Agents'],
      order: CHOLIBA_ORDER,
    },
    provide: (container) => {
      container.provide(RUNTIME, () => runtime);
      container.provide(TOOLS, (c) => new ToolsService(c.get(RUNTIME), c.get(CONFIG), c.get(PLATFORM).which));
    },
    commands: [checkCommand, lintCommand, formatCommand, setupCommand],
  };
}

/**
 * The packages' commands in the shell, in a fixed order. A package adds a command to its own module, never here, so
 * moving commands of different packages to the shell never touches the same file.
 */
export const CHOLIBA_SHELL: readonly ShellModule[] = [
  coreShell,
  agentsShell,
  projectsShell,
  runnerShell,
  terminalShell,
];

/** The shell of choliba on `platform` and `runtime`: the commands that no longer need Nest. */
export function createCholibaShell(
  platform: Platform,
  runtime: Runtime,
  modules: readonly ShellModule[] = CHOLIBA_SHELL,
): Shell {
  return createShell(platform, [...modules, cholibaShell(runtime)]);
}
