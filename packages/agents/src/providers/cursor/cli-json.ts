import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PlannedFile } from '../interfaces/provider.interface';
import type { CursorPermissions } from './permissions';

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

/** What `<workspaceRoot>/.cursor/<fileName>` held before the run (`undefined`: no file) and what it would hold. */
interface CursorFilePlan extends PlannedFile {
  readonly original: string | undefined;
}

/** `<workspaceRoot>/.cursor/<fileName>` with `merge` applied to what is there, without writing anything. */
function planCursorFile(workspaceRoot: string, fileName: string, merge: Merge): CursorFilePlan {
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
  return { path, original, content: `${JSON.stringify(merge(parsed), null, 2)}\n` };
}

/**
 * Rewrites `<workspaceRoot>/.cursor/<fileName>` with `merge` for one run, and returns the function
 * that puts things back: the original file byte for byte when there was one (kept in memory, never
 * in a temp file), otherwise the generated file is removed, and `.cursor/` too if it ends up empty.
 * Safe to call the returned function more than once.
 */
function applyCursorFile(workspaceRoot: string, fileName: string, merge: Merge): () => void {
  const dir = join(workspaceRoot, '.cursor');
  const dirExisted = existsSync(dir);
  const plan = planCursorFile(workspaceRoot, fileName, merge);

  mkdirSync(dir, { recursive: true });
  writeFileSync(plan.path, plan.content, 'utf8');

  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    if (plan.original !== undefined) {
      writeFileSync(plan.path, plan.original, 'utf8');
      return;
    }
    rmSync(plan.path, { force: true });
    if (!dirExisted && readdirSync(dir).length === 0) {
      rmdirSync(dir);
    }
  };
}

/** What `applyCursorPermissions` would write into `.cursor/cli.json`, writing nothing. */
export function planCursorPermissions(workspaceRoot: string, permissions: CursorPermissions): PlannedFile {
  const { path, content } = planCursorFile(workspaceRoot, 'cli.json', (existing) =>
    mergeCliJson(existing, permissions),
  );
  return { path, content };
}

/** What `applyCursorMcpServers` would write into `.cursor/mcp.json`, writing nothing. */
export function planCursorMcpServers(
  workspaceRoot: string,
  servers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): PlannedFile {
  const { path, content } = planCursorFile(workspaceRoot, 'mcp.json', (existing) => mergeMcpJson(existing, servers));
  return { path, content };
}

/** Writes the agent's permissions into `.cursor/cli.json` for one run (see `applyCursorFile`). */
export function applyCursorPermissions(workspaceRoot: string, permissions: CursorPermissions): () => void {
  return applyCursorFile(workspaceRoot, 'cli.json', (existing) => mergeCliJson(existing, permissions));
}

/** Writes the agent's MCP servers into `.cursor/mcp.json` for one run (see `applyCursorFile`). */
export function applyCursorMcpServers(
  workspaceRoot: string,
  servers: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): () => void {
  return applyCursorFile(workspaceRoot, 'mcp.json', (existing) => mergeMcpJson(existing, servers));
}
