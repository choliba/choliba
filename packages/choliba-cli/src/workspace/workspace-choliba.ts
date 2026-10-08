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

/** `--version`: this command's line, then, inside a workspace, its `choliba`'s, as it prints it. */
export function versionLines(machineLine: string, runtime: CliRuntime, start: string): string {
  const root = workspaceAt(start);
  if (root === undefined) return machineLine;
  const run = runtime.capture(workspaceCholiba(root), ['--version'], root);
  const workspaceLine = run.status === 0 ? run.stdout.trim() : 'choliba (versão desconhecida)';
  return `${machineLine}\n${workspaceLine} (pasta de trabalho ${root})`;
}
