import type { PermissionContext, PermissionObject, PermissionRequest } from '@choliba/sandbox';

import type { AgentEvent, ProviderRequest } from '../ports';
import { mcpUseOf } from './mcp-guard';

type ToolCall = Extract<AgentEvent, { type: 'tool-call' }>;

type ToolObject = Extract<PermissionObject, { kind: 'tool' }>;

/** A tool as a request names it: always a name, and a server for an MCP tool. */
type InvokedTool = Omit<ToolObject, 'kind'>;

/** A request to invoke a tool. */
export type ToolRequest = PermissionRequest & { readonly object: ToolObject };

/** What a run's requests have in common: its mode and, when it has one, its project. */
export function permissionContext(request: Pick<ProviderRequest, 'mode' | 'project'>): PermissionContext {
  if (request.project === undefined) return { mode: request.mode };
  return { mode: request.mode, project: request.project.name };
}

/**
 * The tool `event` invokes: an MCP tool of its server, or a tool of the provider itself, which has no server.
 * A discovery of MCP tools invokes no tool of a server, so it is none: the MCP guard checks it.
 */
function invokedTool(event: ToolCall): InvokedTool | undefined {
  const use = mcpUseOf(event);
  if (use === undefined) return { name: event.name };
  if (use.kind === 'discovery') return undefined;
  return { server: use.server, name: use.tool };
}

/** The request to the sandbox for a provider's call to a tool, made by `agent`; `undefined` for any other event. */
export function toolRequest(event: AgentEvent, agent: string, context: PermissionContext): ToolRequest | undefined {
  if (event.type !== 'tool-call') return undefined;
  const tool = invokedTool(event);
  if (tool === undefined) return undefined;
  return { subject: { kind: 'agent', id: agent }, action: 'invoke', object: { kind: 'tool', ...tool }, context };
}
