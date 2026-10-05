import type { PermissionPolicy } from '../../agents/interfaces/command.interface';
import type { McpServer } from '../../mcps/mcps';
import type { AgentPermissions, ExecuteRule } from '../../runs/permissions';
import { allowedCommands, blocksEveryCommand, pathGlob, withoutTrailingSlash } from '../../runs/permissions';

/** The tools that read files, which the session gets once the agent may read somewhere. */
const READ_TOOLS: readonly string[] = ['Read', 'Grep', 'Glob'];

/** The tools that write files, which the session gets once the agent may write somewhere. */
const WRITE_TOOLS: readonly string[] = ['Edit', 'Write'];

export interface ClaudePermissionArgs {
  readonly permissionMode: string;
  /** `--tools`: the only built-in tools the session has; empty when the agent may do nothing itself. */
  readonly tools: readonly string[];
  readonly allowedTools: readonly string[];
  readonly disallowedTools: readonly string[];
}

/**
 * A declared path (always absolute here, see `absolutePermissions`) in Claude Code's rule syntax, where
 * `/x` means "relative to the project root" and a filesystem-absolute path needs two slashes.
 */
export function claudePath(path: string): string {
  return `/${pathGlob(path)}`;
}

function writeRules(paths: readonly string[]): string[] {
  return paths.flatMap((path) => [`Edit(${claudePath(path)})`, `Write(${claudePath(path)})`]);
}

/** Claude Code's rules for an MCP server: one per tool it lists, or one for the whole server. */
export function mcpRules(server: McpServer): string[] {
  return server.tools === undefined
    ? [`mcp__${server.name}`]
    : server.tools.map((tool) => `mcp__${server.name}__${tool}`);
}

function commandRule(command: string): string {
  return `Bash(${command}:*)`;
}

/** A deny rule in Claude's syntax: its commands, or — for `['*']` — any `cd` into the directory. */
function denyRunRules(rule: ExecuteRule): readonly string[] {
  return blocksEveryCommand(rule)
    ? [commandRule(`cd ${withoutTrailingSlash(rule.dir)}`)]
    : rule.commands.map(commandRule);
}

/**
 * Translates what agent.yaml declares (`permissions`, already absolute, and the MCP servers in `mcps`)
 * into Claude Code's permission flags — nothing is hardcoded here, so an agent gets exactly what it
 * declares. The mode is always `dontAsk`: anything not allowed is denied without prompting (a headless
 * run could never answer). The session only has the tools the permissions need, none when they allow
 * nothing; and since it runs in an empty folder (`ProviderRequest.runDir`), the only files it may read
 * or write are the ones the `Read`/`Edit`/`Write` rules name. Deny rules always apply.
 */
export function claudePermissionArgs(
  permissions: AgentPermissions,
  policy: PermissionPolicy,
  mcpServers: readonly McpServer[],
): ClaudePermissionArgs {
  const writes = policy === 'read-only' ? [] : permissions.allowWrite;
  const commands = allowedCommands(permissions);
  // The read tools are never allowed bare (that would be anywhere): the session has them, and the
  // `Read(<path>)` rules, which Claude applies to Grep and Glob too, say where.
  const tools = [
    ...(permissions.allowRead.length > 0 ? READ_TOOLS : []),
    ...(writes.length > 0 ? WRITE_TOOLS : []),
    ...(commands.length > 0 ? ['Bash'] : []),
  ];
  return {
    permissionMode: 'dontAsk',
    tools,
    allowedTools: [
      ...permissions.allowRead.map((path) => `Read(${claudePath(path)})`),
      ...writeRules(writes),
      ...commands.map(commandRule),
      ...mcpServers.flatMap(mcpRules),
    ],
    disallowedTools: [
      ...permissions.denyRead.map((path) => `Read(${claudePath(path)})`),
      ...writeRules(permissions.denyWrite),
      ...permissions.denyExecute.flatMap(denyRunRules),
    ],
  };
}
