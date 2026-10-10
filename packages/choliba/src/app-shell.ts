import { agentsShell } from '@choliba/agents';
import { coreShell, createShell, type Platform, type Shell, type ShellModule } from '@choliba/core';
import { projectsShell } from '@choliba/projects';
import { runnerShell } from '@choliba/runner';
import { terminalShell } from '@choliba/terminal';

/** The commands of the choliba app itself in the shell: `check`, `setup`, `lint` and `format` move here from Nest. */
export const cholibaShell: ShellModule = { name: 'choliba', commands: [] };

/**
 * Every package's commands in the shell, in a fixed order. A package adds a command to its own module, never here, so
 * moving commands of different packages to the shell never touches the same file.
 */
export const CHOLIBA_SHELL: readonly ShellModule[] = [
  coreShell,
  agentsShell,
  projectsShell,
  runnerShell,
  terminalShell,
  cholibaShell,
];

/** The shell of choliba on `platform`: the commands that no longer need Nest. */
export function createCholibaShell(platform: Platform, modules: readonly ShellModule[] = CHOLIBA_SHELL): Shell {
  return createShell(platform, modules);
}
