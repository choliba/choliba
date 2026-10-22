import { join } from 'node:path';

import { agentsShell } from '@choliba/agents';
import { defineConfig, type ConfigGroup } from '@choliba/config';
import {
  coreShell,
  createShell,
  findResource,
  PANEL_ICON,
  PANEL_LOGO,
  PANEL_VERSION,
  PLATFORM,
  parseColors,
  THEME_CHOICES,
  WORKSPACE_ROOT,
  versionLine,
  type Platform,
  type Shell,
  type ShellModule,
} from '@choliba/core';
import { projectsShell } from '@choliba/projects';
import { runnerShell } from '@choliba/runner';
import { tuiShell } from '@choliba/tui';

import { addCommand } from './add';
import {
  cholibaLibrary,
  type Choliba,
  type CholibaAgents,
  type CholibaConfig,
  type CholibaOptions,
  type CholibaProjects,
  type CholibaProviders,
  type CholibaSkills,
  type CholibaWorkspace,
} from './library';
import { checkCommand } from './check';
import { findWorkspaceRoot, listConfigCommand, setConfigCommand, workspaceConfigSources } from './config';
import { CHOLIBA_ORDER, CHOLIBA_ROOT, CHOLIBA_VERBS, cholibaManifest, OWL_ICON, PACKAGE_NAME } from './help';
import { RUNTIME, type Runtime } from './runtime';
import { setupCommand } from './setup';
import { formatCommand, lintCommand, TOOLS, ToolsService } from './tooling';
import { updateCommand } from './update';

const cholibaConfig = defineConfig('choliba', {
  colors: {
    env: 'CHOL_COLORS',
    type: 'string',
    description: 'cores do choliba (papel.nome=cor)',
  },
});

/**
 * The commands of the choliba app itself in the shell, on its `runtime`: `add`, `check`, `lint`, `format`, `setup` and `update`. The
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
      container.provide(PANEL_LOGO, () => findResource(join('assets', 'choliba-logo.png'), __dirname));
      container.provide(PANEL_ICON, () => OWL_ICON);
      container.provide(PANEL_VERSION, () => versionLine(PACKAGE_NAME, cholibaManifest()));
      container.provide(WORKSPACE_ROOT, (current) => findWorkspaceRoot(current.get(PLATFORM).cwd));
      container.provide(THEME_CHOICES, (current) => parseColors(current.get(cholibaConfig.token).colors));
      container.provide(TOOLS, (c) => new ToolsService(c.get(RUNTIME), c.get(WORKSPACE_ROOT), c.get(PLATFORM).which));
    },
    commands: [
      addCommand,
      checkCommand,
      listConfigCommand,
      setConfigCommand,
      lintCommand,
      formatCommand,
      setupCommand,
      updateCommand,
    ],
  };
}

/**
 * The packages' commands in the shell, in a fixed order. A package adds a command to its own module, never here, so
 * moving commands of different packages to the shell never touches the same file.
 */
export const CHOLIBA_SHELL: readonly ShellModule[] = [coreShell, tuiShell, agentsShell, projectsShell, runnerShell];

/** The shell of choliba on `platform` and `runtime`. */
export function createCholibaShell(
  platform: Platform,
  runtime: Runtime,
  modules: readonly ShellModule[] = CHOLIBA_SHELL,
): Shell {
  return createShell(platform, [...modules, cholibaShell(runtime)], workspaceConfigSources(platform));
}

/** The configuration groups of choliba's shell, in its order and each once: what `list config` lists. */
function cholibaConfigGroups(): readonly ConfigGroup[] {
  const groups = [...CHOLIBA_SHELL.flatMap((module) => module.config ?? []), cholibaConfig];
  return groups.filter((group, index) => groups.indexOf(group) === index);
}

/** choliba for a script, from `options.cwd` (else the process's folder) and `options.env` (else its environment). */
export function openCholiba(options: CholibaOptions = {}): Choliba {
  return cholibaLibrary(cholibaConfigGroups(), options);
}

/** choliba for a script, from the process's folder and environment, read on first use (`openCholiba()`). */
export const choliba: Choliba = openCholiba();

// Each module of `choliba` by its name, to import alone: `import { agents } from 'choliba'`. Typed one by one, so the
// published declarations name their types instead of inlining an `import()` a `nodenext` project cannot resolve.
export const workspace: CholibaWorkspace = choliba.workspace;
export const config: CholibaConfig = choliba.config;
export const providers: CholibaProviders = choliba.providers;
export const agents: CholibaAgents = choliba.agents;
export const skills: CholibaSkills = choliba.skills;
export const projects: CholibaProjects = choliba.projects;
