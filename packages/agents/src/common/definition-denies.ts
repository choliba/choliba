import { denyExceptions, isWithin, withoutTrailingSlash } from '@choliba/sandbox';

import { type AgentPermissions } from './agent-permissions';
import type { AgentDefinition } from './interfaces/agent.interface';

/** A definition folder as a deny entry: the folder and everything under it. */
function asFolder(dir: string): string {
  return `${withoutTrailingSlash(dir)}/`;
}

/**
 * The agent with the agent, skill and MCP folders denied to write and delete, whatever it declares.
 * A `!` inside them is refused separately (`definitionExceptionProblems`): it must not reopen them.
 */
export function withDefinitionDenies(agent: AgentDefinition, directories: readonly string[]): AgentDefinition {
  const folders = directories.map(asFolder);
  const { permissions } = agent;
  return {
    ...agent,
    permissions: {
      ...permissions,
      denyWrite: [...permissions.denyWrite, ...folders],
      denyDelete: [...permissions.denyDelete, ...folders],
    },
  };
}

/** One `!` of `deny.write` or `deny.delete` that is a definition folder or lies inside one. */
function reopened(key: string, entries: readonly string[], roots: readonly string[]): readonly string[] {
  return denyExceptions(entries)
    .filter((exception) => roots.some((root) => isWithin(root, exception)))
    .map((exception) => `  exception.${key}: ${exception} reabre uma definição do choliba, que nenhuma run altera`);
}

/**
 * The `!` exceptions of `deny.write` and `deny.delete` that sit on a definition folder or inside it.
 * `deny.read` is left alone: a declared skill is still readable.
 */
export function definitionExceptionProblems(
  permissions: AgentPermissions,
  directories: readonly string[],
): readonly string[] {
  const roots = directories.map((dir) => withoutTrailingSlash(dir));
  return [...reopened('write', permissions.denyWrite, roots), ...reopened('delete', permissions.denyDelete, roots)];
}
