import { isAbsolute, join } from 'node:path';

import type { PermissionPolicy } from '../../command.types';
import type { McpServer } from '../../mcps';
import type { AgentPermissions } from '../../permissions';
import { pathGlob } from '../../permissions';

export interface CursorPermissions {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/**
 * `Shell(...)` token for a command prefix: cursor matches the first word, with the rest as
 * `word:args` — `prettier` → `Shell(prettier)`, `bun run format` → `Shell(bun:run format*)`.
 */
export function shellToken(command: string): string {
  const normalized = command.trim().replaceAll(/\s+/g, ' ');
  const space = normalized.indexOf(' ');
  return space === -1
    ? `Shell(${normalized})`
    : `Shell(${normalized.slice(0, space)}:${normalized.slice(space + 1)}*)`;
}

/**
 * Cursor matches `Read`/`Write` patterns against the absolute path of the file — a relative
 * `Write(docs/**)` matches nothing (checked with a real run) — so declared paths are anchored
 * at the workspace root.
 */
function fileToken(kind: 'Read' | 'Write', path: string, workspaceRoot: string): string {
  const glob = pathGlob(path);
  return `${kind}(${isAbsolute(glob) ? glob : join(workspaceRoot, glob)})`;
}

/**
 * Cursor prefixes commands with `cd <workspace> &&` on its own, and checks each part of a compound
 * command: without that `cd` allowed, every allowed command came back rejected. Only the `cd` into
 * the workspace root is allowed, so the agent cannot run its commands from anywhere else —
 * `cd /tmp && …` stays rejected (both checked with real runs).
 */
function cdToken(workspaceRoot: string): string {
  return `Shell(cd:${workspaceRoot})`;
}

/** Cursor's tokens for an MCP server: one per tool it lists, or one for the whole server. */
export function mcpTokens(server: McpServer): string[] {
  return (server.tools ?? ['*']).map((tool) => `Mcp(${server.name}:${tool})`);
}

/**
 * Translates what system.md declares (and the MCP servers agent.yaml lists) into cursor's
 * `permissions` (the `.cursor/cli.json` format). Nothing is hardcoded: an agent gets exactly what
 * it declares. Cursor has no per-tool switch, so `<tool>` entries only matter to Claude; write
 * permissions only apply outside read-only runs.
 */
export function cursorPermissions(
  permissions: AgentPermissions,
  policy: PermissionPolicy,
  workspaceRoot: string,
  mcpServers: readonly McpServer[] = [],
): CursorPermissions {
  return {
    allow: [
      ...permissions.allowRead.map((path) => fileToken('Read', path, workspaceRoot)),
      ...(policy === 'read-only' ? [] : permissions.allowWrite.map((path) => fileToken('Write', path, workspaceRoot))),
      ...permissions.allowRun.map(shellToken),
      ...(permissions.allowRun.length > 0 ? [cdToken(workspaceRoot)] : []),
      ...mcpServers.flatMap(mcpTokens),
    ],
    deny: [
      ...permissions.denyRead.map((path) => fileToken('Read', path, workspaceRoot)),
      ...permissions.denyWrite.map((path) => fileToken('Write', path, workspaceRoot)),
      ...permissions.denyRun.map(shellToken),
    ],
  };
}
