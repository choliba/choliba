import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, sep } from 'node:path';

import type { PermissionPolicy } from '../../agents/interfaces/command.interface';
import type { McpServer } from '../../mcps/mcps';
import type { AgentPermissions, ExecuteRule } from '../../runs/permissions';
import { allowedCommands, blocksEveryCommand, pathBase, pathGlob, withoutTrailingSlash } from '../../runs/permissions';
import type { RunToolCommands } from '../../runs/run-tools/run-tools';
import { isRecord } from '../../shared/json';

export interface CursorPermissions {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/** One entry of a directory: its name and whether it is a folder (a symlink counts as a file). */
export interface DirEntry {
  readonly name: string;
  readonly isDirectory: boolean;
}

/** The entries of `dir`, or none when it cannot be read. */
export type ReadDir = (dir: string) => readonly DirEntry[];

export const readDir: ReadDir = (dir) => {
  try {
    return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
    }));
  } catch {
    return [];
  }
};

/**
 * `Shell(...)` token for a command prefix: cursor matches the first word, with the rest as
 * `word:args` — `prettier` → `Shell(prettier)`, `bun run format` → `Shell(bun:run format*)`.
 */
export function shellToken(command: string): string {
  const normalized = command.trim().replaceAll(/\s+/g, ' ');
  const space = normalized.indexOf(' ');
  return space === -1 ? `Shell(${normalized})` : `Shell(${normalized.slice(0, space)}:${normalized.slice(space + 1)}*)`;
}

/** A declared path (already absolute) as cursor's `Read(...)`/`Write(...)` token. */
function fileToken(kind: 'Read' | 'Write', path: string): string {
  return `${kind}(${pathGlob(path)})`;
}

/** The folders from `/` down to (not including) `path`: `/a/b/c` → `/`, `/a`, `/a/b`. */
function ancestors(path: string): readonly string[] {
  const found: string[] = [];
  for (let dir = dirname(path); ; dir = dirname(dir)) {
    found.unshift(dir);
    if (dir === dirname(dir)) {
      return found;
    }
  }
}

function covers(kept: string, path: string): boolean {
  return kept === path || kept.startsWith(`${path}${sep}`) || path.startsWith(`${kept}${sep}`);
}

/**
 * Everything on disk that is not one of `kept` nor on the way to one, as the fewest paths: in each
 * folder from `/` down to a kept path, every entry that leads to no kept path. Cursor treats `allow`
 * as no limit at all (it reads and writes outside it, sandbox or not) but always honors `deny`, which
 * wins over `allow`; so denying this complement is what makes only the kept paths reachable. What is
 * created after the list is made, right in one of those folders, is not in it.
 */
export function complementOf(kept: readonly string[], read: ReadDir): readonly string[] {
  const denied = new Set<string>();
  for (const dir of new Set(kept.flatMap(ancestors))) {
    for (const entry of read(dir)) {
      const path = join(dir, entry.name);
      if (!kept.some((keptPath) => covers(keptPath, path))) {
        denied.add(entry.isDirectory ? `${path}/` : path);
      }
    }
  }
  return [...denied].sort();
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
      ...permissions.allowRead.map((path) => fileToken('Read', path)),
      ...writes.map((path) => fileToken('Write', path)),
      ...allowedCommands(permissions).map(shellToken),
      ...runTools.allow.map(shellToken),
      ...cdTokens(permissions, workspaceRoot, runDir, runTools),
      ...mcpServers.flatMap(mcpTokens),
    ],
    deny: [
      ...permissions.denyRead.map((path) => fileToken('Read', path)),
      ...permissions.denyWrite.map((path) => fileToken('Write', path)),
      // The run tools are allowed to run, so they must never be rewritten (once written, the complement names them too).
      ...runTools.scripts.map((path) => fileToken('Write', path)),
      ...permissions.denyExecute.flatMap(denyShellTokens),
      ...runTools.deny.map(shellToken),
      ...readable.map((path) => fileToken('Read', path)),
      ...writable.map((path) => fileToken('Write', path)),
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
