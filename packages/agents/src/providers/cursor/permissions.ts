import { isAbsolute, join } from 'node:path';

import type { PermissionPolicy } from '../../command.types';
import type { McpServer } from '../../mcps';
import type { AgentPermissions, ExecuteRule } from '../../permissions';
import { allowedCommands, blocksEveryCommand, pathGlob, withoutTrailingSlash } from '../../permissions';

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
  return space === -1 ? `Shell(${normalized})` : `Shell(${normalized.slice(0, space)}:${normalized.slice(space + 1)}*)`;
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

/** A directory of `execute` as an absolute path: relative ones are relative to the workspace root. */
function absoluteDir(dir: string, workspaceRoot: string): string {
  return withoutTrailingSlash(isAbsolute(dir) ? dir : join(workspaceRoot, dir));
}

/**
 * Cursor prefixes commands with `cd <workspace> &&` on its own, and checks each part of a compound
 * command: without that `cd` allowed, every allowed command came back rejected. Only the `cd` into
 * the workspace root and into the directories `execute` names is allowed, so the agent cannot run its
 * commands from anywhere else — `cd /tmp && …` stays rejected (both checked with real runs).
 */
function cdTokens(permissions: AgentPermissions, workspaceRoot: string): readonly string[] {
  if (permissions.allowExecute.length === 0) {
    return [];
  }
  const dirs = [workspaceRoot, ...permissions.allowExecute.map((rule) => absoluteDir(rule.dir, workspaceRoot))];
  return [...new Set(dirs)].map((dir) => `Shell(cd:${dir})`);
}

/** A deny rule in cursor's syntax: its commands, or — for `['*']` — the `cd` into the directory. */
function denyShellTokens(rule: ExecuteRule, workspaceRoot: string): readonly string[] {
  return blocksEveryCommand(rule)
    ? [`Shell(cd:${absoluteDir(rule.dir, workspaceRoot)})`]
    : rule.commands.map(shellToken);
}

/** Cursor's tokens for an MCP server: one per tool it lists, or one for the whole server. */
export function mcpTokens(server: McpServer): string[] {
  return (server.tools ?? ['*']).map((tool) => `Mcp(${server.name}:${tool})`);
}

/**
 * Translates what agent.yaml declares (`permissions` and the MCP servers in `mcps`) into cursor's
 * `permissions` (the `.cursor/cli.json` format). Nothing is hardcoded: an agent gets exactly what
 * it declares. Write permissions only apply outside read-only runs.
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
      ...allowedCommands(permissions).map(shellToken),
      ...cdTokens(permissions, workspaceRoot),
      ...mcpServers.flatMap(mcpTokens),
    ],
    deny: [
      ...permissions.denyRead.map((path) => fileToken('Read', path, workspaceRoot)),
      ...permissions.denyWrite.map((path) => fileToken('Write', path, workspaceRoot)),
      ...permissions.denyExecute.flatMap((rule) => denyShellTokens(rule, workspaceRoot)),
    ],
  };
}
