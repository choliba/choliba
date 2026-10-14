import type { McpDeclaration } from '../../common';
import type { AgentEvent, McpUse } from '../../common';

/** Any tool whose name speaks of MCP, for a call its provider's parser did not classify. */
const MCP_NAME = /mcp/i;

type Discovery = Extract<McpUse, { kind: 'discovery' }>;

/**
 * How `event` uses MCP: what its provider's parser said, or, for any other tool named after MCP (a new
 * provider, a new discovery tool), a discovery of no particular server. `undefined` when it uses none.
 */
export function mcpUseOf(event: AgentEvent): McpUse | undefined {
  if (event.type !== 'tool-call') {
    return undefined;
  }
  if (event.mcp !== undefined) {
    return event.mcp;
  }
  return MCP_NAME.test(event.name) ? { kind: 'discovery' } : undefined;
}

/** A discovery looks for tools: allowed in an agent that declares MCPs, in a server it declares. */
function discoveryAllowed(use: Discovery, declared: readonly McpDeclaration[]): boolean {
  return declared.length > 0 && (use.server === undefined || declared.some(({ name }) => name === use.server));
}

function undeclaredMessage(what: string, agent: string, declared: readonly McpDeclaration[]): string {
  const servers = declared.length === 0 ? 'nenhum MCP' : declared.map(({ name }) => name).join(', ');
  return `✗ o agente tentou usar um MCP não declarado (${what}); a execução foi interrompida: ${agent} declara ${servers} em agent.yaml#mcps.`;
}

/**
 * Why a discovery of MCP tools may not run: the agent declares no MCP, or the server it looks in is not one it
 * declares. `undefined` for any other event, and for a discovery it may run. A discovery invokes no tool of a server,
 * so it is checked here and not asked of the sandbox.
 */
export function discoveryViolation(
  event: AgentEvent,
  agent: string,
  declared: readonly McpDeclaration[],
): string | undefined {
  const use = mcpUseOf(event);
  if (use?.kind !== 'discovery' || event.type !== 'tool-call' || discoveryAllowed(use, declared)) {
    return undefined;
  }
  const what = use.server === undefined ? event.name : `${event.name} em ${use.server}`;
  return undeclaredMessage(what, agent, declared);
}

/**
 * Why the sandbox denied a call to `tool` of `server`, naming the key of `agent.yaml` that would allow it: the
 * server's `tools` when it lists them, `mcps` otherwise.
 */
export function mcpCallMessage(
  call: { readonly server: string; readonly tool: string },
  agent: string,
  declared: readonly McpDeclaration[],
): string {
  const tools = declared.find(({ name }) => name === call.server)?.tools;
  if (tools !== undefined) {
    return `✗ o agente tentou usar uma tool que ${agent} não declara (${call.server}:${call.tool}); a execução foi interrompida: ${call.server} declara ${tools.join(', ')} em agent.yaml#mcps.${call.server}.tools.`;
  }
  return undeclaredMessage(`${call.server}:${call.tool}`, agent, declared);
}
