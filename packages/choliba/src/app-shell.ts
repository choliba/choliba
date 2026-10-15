import { agentsShell } from '@choliba/agents';
import { defineConfig } from '@choliba/config';
import {
  CONFIG,
  coreShell,
  createShell,
  PLATFORM,
  parseColors,
  THEME_CHOICES,
  versionLine,
  type Platform,
  type Shell,
  type ShellModule,
} from '@choliba/core';
import { projectsShell } from '@choliba/projects';
import { runnerShell } from '@choliba/runner';

import { addCommand } from './add';
import { checkCommand } from './check';
import { listConfigCommand, setConfigCommand, workspaceConfigSources } from './config';
import { CHOLIBA_ORDER, CHOLIBA_ROOT, CHOLIBA_VERBS, cholibaManifest, PACKAGE_NAME } from './help';
import { RUNTIME, type Runtime } from './runtime';
import { setupCommand } from './setup';
import { formatCommand, lintCommand, TOOLS, ToolsService } from './tooling';

const cholibaConfig = defineConfig('choliba', {
  colors: {
    env: 'CHOL_COLORS',
    type: 'string',
    description: 'cores do choliba (papel.nome=cor)',
  },
});

/**
 * The commands of the choliba app itself in the shell, on its `runtime`: `add`, `check`, `lint`, `format` and `setup`. The
 * app's last module, as only the app has a runtime.
 */
export function cholibaShell(runtime: Runtime): ShellModule {
  return {
    name: 'choliba',
    config: [cholibaConfig],
    root: {
      spec: CHOLIBA_ROOT,
      version: () => versionLine(PACKAGE_NAME, cholibaManifest()),
      groups: ['Commands'],
      order: CHOLIBA_ORDER,
      verbs: CHOLIBA_VERBS,
    },
    provide: (container) => {
      container.provide(RUNTIME, () => runtime);
      container.provide(THEME_CHOICES, (current) => parseColors(current.get(cholibaConfig.token).colors));
      container.provide(TOOLS, (c) => new ToolsService(c.get(RUNTIME), c.get(CONFIG), c.get(PLATFORM).which));
    },
    commands: [addCommand, checkCommand, listConfigCommand, setConfigCommand, lintCommand, formatCommand, setupCommand],
  };
}

/**
 * The packages' commands in the shell, in a fixed order. A package adds a command to its own module, never here, so
 * moving commands of different packages to the shell never touches the same file.
 */
export const CHOLIBA_SHELL: readonly ShellModule[] = [coreShell, agentsShell, projectsShell, runnerShell];

/** The shell of choliba on `platform` and `runtime`. */
export function createCholibaShell(
  platform: Platform,
  runtime: Runtime,
  modules: readonly ShellModule[] = CHOLIBA_SHELL,
): Shell {
  return createShell(platform, [...modules, cholibaShell(runtime)], workspaceConfigSources(platform));
}
