import { join } from 'node:path';

import { findWorkspaceRoot, type CommandEntry } from '@choliba/core';

import type { CliRuntime } from '../runtime';

/** The section of the help the workspace's commands are listed under. */
export const WORKSPACE_GROUP = 'Workspace commands';

/** The workspace `start` is in (its root), or `undefined` outside one. */
export function workspaceAt(start: string): string | undefined {
  try {
    return findWorkspaceRoot(start);
  } catch {
    return undefined;
  }
}

/** The workspace's own `choliba`, the one its `package.json` depends on. */
export function workspaceCholiba(root: string): string {
  return join(root, 'node_modules', '.bin', 'choliba');
}

function isEntry(value: unknown): value is Pick<CommandEntry, 'name' | 'description'> {
  const entry = value as Partial<CommandEntry> | null;
  return typeof entry?.name === 'string' && typeof entry.description === 'string';
}

/**
 * The commands the workspace's `choliba` lists (`__entries`), as entries of this help: run through it, so each
 * is `choliba <name>` here too. None when it cannot say (an older `choliba`, a broken install).
 */
export function workspaceEntries(runtime: CliRuntime, root: string): readonly CommandEntry[] {
  const run = runtime.capture(workspaceCholiba(root), ['__entries'], root);
  if (run.status !== 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(run.stdout);
  } catch {
    return [];
  }
  return (Array.isArray(parsed) ? parsed : []).filter(isEntry).map((entry) => ({
    name: entry.name,
    description: entry.description,
    group: WORKSPACE_GROUP,
    spec: { usage: `choliba ${entry.name} [ARGS]` },
  }));
}

/** Commands of this binary. Their completion stays here, even inside a workspace. */
const MACHINE_COMMANDS = new Set(['new', 'n', 'generate', 'g', 'add']);

/** The first word already typed (not the one being completed, and not a flag). */
function typedCommand(words: readonly string[]): string | undefined {
  return words.slice(0, -1).find((word) => word !== '' && !word.startsWith('-'));
}

/**
 * When the first word is a command of the workspace's choliba, its `__complete` output (including `:files`).
 * `undefined` when this binary should answer: no command yet, or `new` / `n` / `generate` / `g` / `add`.
 */
export function delegateWorkspaceComplete(
  runtime: CliRuntime,
  start: string,
  words: readonly string[],
): string | undefined {
  const command = typedCommand(words);
  if (command === undefined || MACHINE_COMMANDS.has(command)) return undefined;
  const root = workspaceAt(start);
  if (root === undefined) return undefined;
  const names = workspaceCommandEntries(runtime, root).map((entry) => entry.name);
  if (!names.includes(command)) return undefined;
  const run = runtime.capture(workspaceCholiba(root), ['__complete', ...words], root);
  if (run.status !== 0) return undefined;
  if (run.stdout === '' || run.stdout.endsWith('\n')) return run.stdout;
  return `${run.stdout}\n`;
}

/** The workspace commands, for this help. None outside a workspace or when its `choliba` cannot list them. */
export function workspaceCommandEntries(runtime: CliRuntime, start: string): readonly CommandEntry[] {
  const root = workspaceAt(start);
  return root === undefined ? [] : workspaceEntries(runtime, root);
}

/** `--version`: this command's line, then, inside a workspace, its `choliba`'s, as it prints it. */
export function versionLines(machineLine: string, runtime: CliRuntime, start: string): string {
  const root = workspaceAt(start);
  if (root === undefined) return machineLine;
  const run = runtime.capture(workspaceCholiba(root), ['--version'], root);
  const workspaceLine = run.status === 0 ? run.stdout.trim() : 'choliba (versão desconhecida)';
  return `${machineLine}\n${workspaceLine} (pasta de trabalho ${root})`;
}
