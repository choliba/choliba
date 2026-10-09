import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { PermissionPolicy } from '../../common';
import type { McpServer } from '../../common';
import type { AgentPermissions, ExecuteRule } from '../../common';
import { allowedCommands, blocksEveryCommand, pathBase, pathGlobs, withoutTrailingSlash } from '../../common';
import { complementOf, type ReadDir, readDir, resolveDenies } from '../../common';
import type { RunToolCommands } from '../../common';
import { isRecord } from '../../common';

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

/** Declared paths (already absolute) as cursor's `Read(...)`/`Write(...)` tokens. */
function fileTokens(kind: 'Read' | 'Write', paths: readonly string[]): readonly string[] {
  return paths.flatMap((path) => pathGlobs(path)).map((glob) => `${kind}(${glob})`);
}

/** What a list of declared paths reaches: a folder or a file as is, a glob by the folder before it. */
function reached(paths: readonly string[]): readonly string[] {
  return paths.map((path) => {
    if (/[*?[\]]/.test(path)) {
      return pathBase(path);
    }
    return withoutTrailingSlash(path);
  });
}

/**
 * Cursor prefixes commands with `cd <workspace> &&` on its own, and checks each part of a compound
 * command: without that `cd` allowed, every allowed command came back rejected. Only the `cd` into
 * the folder it runs in and into the other folders `execute` names is allowed, so the agent cannot run
 * its commands from anywhere else — `cd /tmp && …` stays rejected (both checked with real runs). The
 * workspace root means the folder the run happens in, which is inside it.
 */
function cdTokens(
  permissions: AgentPermissions,
  workspaceRoot: string,
  runDir: string,
  runTools: RunToolCommands,
): readonly string[] {
  if (permissions.allowExecute.length === 0 && runTools.allow.length === 0) {
    return [];
  }
  const dirs = permissions.allowExecute
    .map((rule) => withoutTrailingSlash(rule.dir))
    .map((dir) => (dir === workspaceRoot ? runDir : dir));
  return [...new Set([runDir, ...dirs])].map((dir) => `Shell(cd:${dir})`);
}

/** A deny rule in cursor's syntax: its commands, or — for `['*']` — the `cd` into the directory. */
function denyShellTokens(rule: ExecuteRule): readonly string[] {
  return blocksEveryCommand(rule) ? [`Shell(cd:${withoutTrailingSlash(rule.dir)})`] : rule.commands.map(shellToken);
}

const NO_RUN_TOOLS: RunToolCommands = { allow: [], deny: [], scripts: [] };

/**
 * Cursor treats `allow` as no limit at all (it reads and writes outside it, sandbox or not) but always honors
 * `deny`, which wins over `allow`; so denying the complement of what is allowed (`complementOf`) is what makes
 * only the allowed paths reachable.
 *
 * Translates what agent.yaml declares (`permissions`, already absolute, and the MCP servers in `mcps`)
 * into cursor's `permissions` (the `.cursor/cli.json` format). Nothing is hardcoded: an agent gets
 * exactly what it declares. Reading and writing anywhere else is denied through the complement of
 * what is allowed (`complementOf`); write permissions only apply outside read-only runs.
 */
export function cursorPermissions(
  permissions: AgentPermissions,
  policy: PermissionPolicy,
  workspaceRoot: string,
  runDir: string,
  mcpServers: readonly McpServer[] = [],
  read: ReadDir = readDir,
  runTools: RunToolCommands = NO_RUN_TOOLS,
): CursorPermissions {
  const writes = policy === 'read-only' ? [] : permissions.allowWrite;
  const readable = complementOf([runDir, ...reached(permissions.allowRead)], read);
  const writable = complementOf([runDir, ...reached(writes)], read);
  return {
    allow: [
      ...fileTokens('Read', permissions.allowRead),
      ...fileTokens('Write', writes),
      ...allowedCommands(permissions).map(shellToken),
      ...runTools.allow.map(shellToken),
      ...cdTokens(permissions, workspaceRoot, runDir, runTools),
      ...mcpServers.flatMap(mcpTokens),
    ],
    deny: [
      ...fileTokens('Read', resolveDenies(permissions.denyRead, read)),
      ...fileTokens('Write', resolveDenies(permissions.denyWrite, read)),
      // The run tools are allowed to run, so they must never be rewritten (once written, the complement names them too).
      ...fileTokens('Write', runTools.scripts),
      ...permissions.denyExecute.flatMap(denyShellTokens),
      ...runTools.deny.map(shellToken),
      ...fileTokens('Read', readable),
      ...fileTokens('Write', writable),
    ],
  };
}

/**
 * The MCP servers the user set up for every Cursor session (`~/.cursor/mcp.json`), which Cursor adds to the ones
 * of the run; none when the file is missing or unreadable.
 */
export function userMcpServers(home: string = homedir()): readonly string[] {
  try {
    const config: unknown = JSON.parse(readFileSync(join(home, '.cursor', 'mcp.json'), 'utf8'));
    const servers = isRecord(config) ? config['mcpServers'] : undefined;
    return isRecord(servers) ? Object.keys(servers) : [];
  } catch {
    return [];
  }
}

/**
 * Denies every server of the user's that the agent does not declare, so Cursor does not offer it in the
 * session. Only a layer on top: any undeclared MCP use, `GetMcpTools` included, already stops the run
 * (`mcp-guard.ts`), whatever the provider.
 */
export function undeclaredMcpTokens(userServers: readonly string[], declared: readonly McpServer[]): string[] {
  return userServers.filter((name) => !declared.some((server) => server.name === name)).map((name) => `Mcp(${name}:*)`);
}

/** Cursor's tokens for an MCP server: one per tool it lists, or one for the whole server. */
export function mcpTokens(server: McpServer): string[] {
  return (server.tools ?? ['*']).map((tool) => `Mcp(${server.name}:${tool})`);
}
