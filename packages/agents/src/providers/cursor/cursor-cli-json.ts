import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { PlannedFile } from '../../common';
import type { CursorPermissions } from './cursor-permissions';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Adds `permissions` to an existing `.cursor/cli.json` document: every other key is kept, and
 * the allow/deny lists are the union of what was there and what the agent declares.
 */
export function mergeCliJson(existing: unknown, permissions: CursorPermissions): Record<string, unknown> {
  const base = isRecord(existing) ? existing : {};
  const current = isRecord(base['permissions']) ? base['permissions'] : {};
  const union = (a: readonly string[], b: readonly string[]): string[] => [...new Set([...a, ...b])];
  return {
    ...base,
    permissions: {
      ...current,
      allow: union(stringList(current['allow']), permissions.allow),
      deny: union(stringList(current['deny']), permissions.deny),
    },
  };
}

/**
 * Adds the agent's MCP servers to an existing `.cursor/mcp.json` document: every other key is kept,
 * and a server the agent lists replaces one of the same name.
 */
export function mergeMcpJson(
  existing: unknown,
  servers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Record<string, unknown> {
  const base = isRecord(existing) ? existing : {};
  const current = isRecord(base['mcpServers']) ? base['mcpServers'] : {};
  return { ...base, mcpServers: { ...current, ...servers } };
}

type Merge = (existing: unknown) => Record<string, unknown>;

/** `<workspaceRoot>/.cursor/<fileName>` with `merge` applied to what is there, without writing anything. */
function planCursorFile(workspaceRoot: string, fileName: string, merge: Merge): PlannedFile {
  const path = join(workspaceRoot, '.cursor', fileName);
  const original = existsSync(path) ? readFileSync(path, 'utf8') : undefined;

  let parsed: unknown = {};
  if (original !== undefined) {
    try {
      parsed = JSON.parse(original);
    } catch {
      throw new Error(`${path} não é um JSON válido; corrija ou remova antes de rodar o agente com o cursor.`);
    }
  }
  return { path, content: `${JSON.stringify(merge(parsed), null, 2)}\n` };
}

/**
 * Writes `content` to `path` for one run and returns the function that puts that path back: the
 * original bytes when there was a file, otherwise the generated file is removed, and its directory
 * too when this write created it and it ends up empty. Safe to call the returned function more than once.
 */
function installFile(path: string, content: string): () => void {
  const dir = dirname(path);
  const dirExisted = existsSync(dir);
  const original = existsSync(path) ? readFileSync(path, 'utf8') : undefined;

  mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, 'utf8');

  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    if (original !== undefined) {
      writeFileSync(path, original, 'utf8');
      return;
    }
    rmSync(path, { force: true });
    if (!dirExisted && readdirSync(dir).length === 0) {
      rmdirSync(dir);
    }
  };
}

/** Rewrites `<workspaceRoot>/.cursor/<fileName>` with `merge` for one run (see `installFile`). */
function applyCursorFile(workspaceRoot: string, fileName: string, merge: Merge): () => void {
  const plan = planCursorFile(workspaceRoot, fileName, merge);
  return installFile(plan.path, plan.content);
}

/**
 * `<dir>/.cursor/cli.json` parsed, or `{}` when the file is absent. A file that is not JSON is refused:
 * merging past it would hide the broken document.
 */
function readCliJson(dir: string): unknown {
  const path = join(dir, '.cursor', 'cli.json');
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${path} não é um JSON válido; corrija ou remova antes de rodar o agente com o cursor.`);
  }
}

/**
 * The `cli.json` cursor-agent loads: `.cursor/cli.json` of the directory it starts in (the run dir).
 * Cursor walks from the git root down to that cwd and, with no git repo, looks only there, so a file
 * at the workspace root is never read and `~/.cursor/cli-config.json` stays in force. A deeper file's
 * arrays replace the ones above it, so this document is already the union of the workspace's own
 * `cli.json` and the agent's permissions. Nothing is written.
 */
export function planCursorPermissions(
  runDir: string,
  workspaceRoot: string,
  permissions: CursorPermissions,
): PlannedFile {
  return {
    path: join(runDir, '.cursor', 'cli.json'),
    content: `${JSON.stringify(mergeCliJson(readCliJson(workspaceRoot), permissions), null, 2)}\n`,
  };
}

/** What `applyCursorMcpServers` would write into `.cursor/mcp.json`, writing nothing. */
export function planCursorMcpServers(
  workspaceRoot: string,
  servers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): PlannedFile {
  const { path, content } = planCursorFile(workspaceRoot, 'mcp.json', (existing) => mergeMcpJson(existing, servers));
  return { path, content };
}

/**
 * Writes the agent's permissions into the run dir's `.cursor/cli.json` (see `planCursorPermissions`).
 * The workspace file is only read. The returned function removes the run file.
 */
export function applyCursorPermissions(
  runDir: string,
  workspaceRoot: string,
  permissions: CursorPermissions,
): () => void {
  const planned = planCursorPermissions(runDir, workspaceRoot, permissions);
  return installFile(planned.path, planned.content);
}

/** Writes the agent's MCP servers into `.cursor/mcp.json` for one run (see `applyCursorFile`). */
export function applyCursorMcpServers(
  workspaceRoot: string,
  servers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): () => void {
  return applyCursorFile(workspaceRoot, 'mcp.json', (existing) => mergeMcpJson(existing, servers));
}
