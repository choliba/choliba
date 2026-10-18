import { decide, type PermissionContext, type PermissionPolicy, type ToolPolicy } from '@choliba/sandbox';

import {
  pathPolicy,
  type AgentEvent,
  type AgentProvider,
  type McpDeclaration,
  type ProviderRequest,
} from '../../common';
import { commandRules, commandViolation, type CommandRules } from './command-guard';
import { SUBAGENT_TOOLS, delegationMessage } from './delegation-guard';
import { discoveryViolation, mcpCallMessage } from './mcp-guard';
import { toolPolicy } from './tool-policy';
import { permissionContext, toolRequest, type ToolRequest } from './tool-request';
import { unenforcedToolMessage } from './unenforced-tool-guard';

/** What the stream guard needs of a run: who the agent is, what it declares, and the policy the sandbox decides on. */
export interface ToolGuard {
  readonly agent: string;
  readonly mcps: readonly McpDeclaration[];
  readonly context: PermissionContext;
  readonly policy: PermissionPolicy;
  /** The commands the agent may run, checked here when the provider cannot limit them (`enforcesExecute`). */
  readonly commands?: CommandRules;
}

/** The guard of one run, its policy written from the agent's permissions and MCPs and the provider's limits. */
export function toolGuard(
  request: ProviderRequest,
  provider: Pick<AgentProvider, 'unenforcedTools' | 'enforcesExecute'>,
): ToolGuard {
  const agent = request.agent;
  return {
    agent: agent.name,
    mcps: agent.mcps,
    context: permissionContext(request),
    policy: { path: pathPolicy(agent.permissions), tool: toolPolicy(agent.mcps, provider.unenforcedTools) },
    ...(provider.enforcesExecute ? {} : { commands: commandRules(request) }),
  };
}

/** Whether the policy speaks of the tool: an MCP tool always, a provider tool only when the policy names it. */
function asked(object: ToolRequest['object'], policy: ToolPolicy): boolean {
  if (object.server !== undefined) return true;
  const entries = [...policy.allow, ...policy.deny, ...policy.exception];
  return entries.some((entry) => entry.server === undefined && entry.name === object.name);
}

/** Why the sandbox denied the call, in the words of the guard that used to stop it. */
function deniedMessage(object: ToolRequest['object'], guard: ToolGuard): string {
  if (object.server !== undefined) {
    return mcpCallMessage({ server: object.server, tool: object.name }, guard.agent, guard.mcps);
  }
  if (SUBAGENT_TOOLS.includes(object.name)) return delegationMessage(object.name);
  return unenforcedToolMessage(object.name);
}

/**
 * Why `event` stops the run, or `undefined` when it may go on. A command is checked against `permissions.execute`
 * when the provider cannot limit it; a call to a tool is asked of the sandbox, which decides on the policy; a discovery
 * of MCP tools is checked by the MCP guard.
 */
export function toolViolation(event: AgentEvent, guard: ToolGuard): string | undefined {
  if (guard.commands !== undefined && event.type === 'tool-call' && event.name === 'Bash') {
    const violation = commandViolation(event.summary, guard.commands);
    if (violation !== undefined) return violation;
  }
  const request = toolRequest(event, guard.agent, guard.context);
  if (request === undefined) return discoveryViolation(event, guard.agent, guard.mcps);
  if (!asked(request.object, guard.policy.tool)) return undefined;
  if (decide(request, guard.policy) === 'allow') return undefined;
  return deniedMessage(request.object, guard);
}
