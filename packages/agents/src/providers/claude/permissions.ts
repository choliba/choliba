import { isAbsolute } from 'node:path';

import type { PermissionPolicy } from '../../command.types';
import type { McpServer } from '../../mcps';
import type { AgentPermissions } from '../../permissions';
import { pathGlob } from '../../permissions';

export interface ClaudePermissionArgs {
  readonly permissionMode: string;
  /** `--tools`: the tools the session has at all; `undefined` leaves Claude's default set. */
  readonly tools: readonly string[] | undefined;
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
}

/**
 * A declared path in Claude Code's rule syntax, where `/x` means "relative to the project root" and a
 * filesystem-absolute path needs two slashes (`//home/...`): so an absolute path gets one more `/`.
 */
export function claudePath(path: string): string {
  const glob = pathGlob(path);
  return isAbsolute(glob) ? `/${glob}` : glob;
}

function writeRules(paths: readonly string[]): string[] {
  return paths.flatMap((path) => [`Edit(${claudePath(path)})`, `Write(${claudePath(path)})`]);
}

/** Claude Code's rules for an MCP server: one per tool it lists, or one for the whole server. */
export function mcpRules(server: McpServer): string[] {
  return server.tools === undefined ? [`mcp__${server.name}`] : server.tools.map((tool) => `mcp__${server.name}__${tool}`);
}

/**
 * Translates what system.md declares (and the MCP servers agent.yaml lists) into Claude Code's
 * permission flags — nothing is hardcoded here, so an agent gets exactly what it declares. The permission mode is always explicit (this
 * session's own claude defaults to a permissive "auto" mode): read-only is `dontAsk` (anything not
 * allowed is denied without prompting, which a headless run could never answer); edits is
 * `dontAsk` too once the agent declares an allowlist, so writes outside it are really blocked, and
 * `acceptEdits` otherwise; full is `bypassPermissions`. Deny rules always apply.
 */
export function claudePermissionArgs(
  permissions: AgentPermissions,
  policy: PermissionPolicy,
  mcpServers: readonly McpServer[],
): ClaudePermissionArgs {
  const readRules = [...permissions.allowTools, ...permissions.allowRead.map((path) => `Read(${claudePath(path)})`)];
  const runRules = permissions.allowRun.map((command) => `Bash(${command}:*)`);
  const allowedTools = [
    ...readRules,
    ...(policy === 'read-only' ? [] : writeRules(permissions.allowWrite)),
    ...runRules,
    ...mcpServers.flatMap(mcpRules),
  ];
  const disallowedTools = [
    ...permissions.denyRead.map((path) => `Read(${claudePath(path)})`),
    ...writeRules(permissions.denyWrite),
    ...permissions.denyRun.map((command) => `Bash(${command}:*)`),
  ];

  if (policy === 'read-only') {
    // Only the declared read tools (plus Bash when commands are allowed) exist in the session.
    const tools = [...permissions.allowTools, ...(permissions.allowRun.length > 0 ? ['Bash'] : [])];
    return { permissionMode: 'dontAsk', tools: tools.length > 0 ? tools : undefined, allowedTools, disallowedTools };
  }
  if (policy === 'edits') {
    return {
      permissionMode: allowedTools.length > 0 ? 'dontAsk' : 'acceptEdits',
      tools: undefined,
      allowedTools,
      disallowedTools,
    };
  }
  return { permissionMode: 'bypassPermissions', tools: undefined, allowedTools, disallowedTools };
}
