import type { McpDeclaration } from '../../common';
import type { AgentEvent, McpUse } from '../../common';

/** Any tool whose name speaks of MCP, for a call its provider's parser did not classify. */
const MCP_NAME = /mcp/i;

/**
 * How `event` uses MCP: what its provider's parser said, or, for any other tool named after MCP (a new
 * provider, a new discovery tool), a discovery of no particular server. `undefined` when it uses none.
 */
function mcpUseOf(event: AgentEvent): McpUse | undefined {
  if (event.type !== 'tool-call') {
    return undefined;
  }
  if (event.mcp !== undefined) {
    return event.mcp;
  }
  return MCP_NAME.test(event.name) ? { kind: 'discovery' } : undefined;
}

function allows(use: McpUse, declared: readonly McpDeclaration[]): boolean {
  if (use.kind === 'discovery') {
    return declared.length > 0 && (use.server === undefined || declared.some(({ name }) => name === use.server));
  }
  const server = declared.find(({ name }) => name === use.server);
  return server !== undefined && (server.tools === undefined || server.tools.includes(use.tool));
}

function what(use: McpUse, event: Extract<AgentEvent, { type: 'tool-call' }>): string {
  if (use.kind === 'call') return `${use.server}:${use.tool}`;
  return use.server === undefined ? event.name : `${event.name} em ${use.server}`;
}

/**
 * Why `event` may not run: it uses an MCP that `agent.yaml#mcps` does not declare (a server, or a tool outside
 * the ones it lists), or looks for MCP tools in an agent that declares none. `undefined` when it may. Every
 * provider is checked here, from its normalized stream: the session only has what the agent declares.
 */
export function mcpViolation(
  event: AgentEvent,
  agent: string,
  declared: readonly McpDeclaration[],
): string | undefined {
  const use = mcpUseOf(event);
  if (use === undefined || event.type !== 'tool-call' || allows(use, declared)) {
    return undefined;
  }
  const server = use.kind === 'call' ? declared.find(({ name }) => name === use.server) : undefined;
  if (use.kind === 'call' && server?.tools !== undefined) {
    return `✗ o agente tentou usar uma tool que ${agent} não declara (${use.server}:${use.tool}); a execução foi interrompida: ${use.server} declara ${server.tools.join(', ')} em agent.yaml#mcps.${use.server}.tools.`;
  }
  const servers = declared.length === 0 ? 'nenhum MCP' : declared.map(({ name }) => name).join(', ');
  return `✗ o agente tentou usar um MCP não declarado (${what(use, event)}); a execução foi interrompida: ${agent} declara ${servers} em agent.yaml#mcps.`;
}
