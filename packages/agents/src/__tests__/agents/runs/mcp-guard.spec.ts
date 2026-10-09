import type { AgentEvent, McpUse } from '../../../common/interfaces/event.interface';
import { mcpViolation } from '../../../agents/runs/mcp-guard';

function call(name: string, mcp?: McpUse): AgentEvent {
  return { type: 'tool-call', id: 'c1', name, summary: '', ...(mcp === undefined ? {} : { mcp }) };
}

const APP = [{ name: 'mcp-app', tools: ['get_issue'] }];
const ANY_GIT = [{ name: 'git' }];

describe('mcpViolation', () => {
  it('stops any MCP use in an agent that declares none, naming what it tried', () => {
    expect(mcpViolation(call('GetMcpTools', { kind: 'discovery' }), 'implementer', [])).toBe(
      '✗ o agente tentou usar um MCP não declarado (GetMcpTools); a execução foi interrompida: implementer declara nenhum MCP em agent.yaml#mcps.',
    );
    expect(mcpViolation(call('Mcp', { kind: 'call', server: 'git', tool: 'log' }), 'implementer', [])).toContain(
      '(git:log)',
    );
  });

  it('lets a declared server be called, within the tools it lists', () => {
    expect(
      mcpViolation(call('Mcp', { kind: 'call', server: 'mcp-app', tool: 'get_issue' }), 'po', APP),
    ).toBeUndefined();
    expect(mcpViolation(call('Mcp', { kind: 'call', server: 'git', tool: 'anything' }), 'po', ANY_GIT)).toBeUndefined();
    expect(mcpViolation(call('Mcp', { kind: 'call', server: 'mcp-app', tool: 'delete_issue' }), 'po', APP)).toBe(
      '✗ o agente tentou usar uma tool que po não declara (mcp-app:delete_issue); a execução foi interrompida: mcp-app declara get_issue em agent.yaml#mcps.mcp-app.tools.',
    );
    expect(mcpViolation(call('Mcp', { kind: 'call', server: 'git', tool: 'log' }), 'po', APP)).toContain('(git:log)');
  });

  it('lets an agent that declares MCPs look for tools, but not in a server it does not declare', () => {
    expect(mcpViolation(call('GetMcpTools', { kind: 'discovery' }), 'po', APP)).toBeUndefined();
    expect(
      mcpViolation(call('ListMcpResourcesTool', { kind: 'discovery', server: 'mcp-app' }), 'po', APP),
    ).toBeUndefined();
    expect(mcpViolation(call('ListMcpResourcesTool', { kind: 'discovery', server: 'git' }), 'po', APP)).toContain(
      '(ListMcpResourcesTool em git)',
    );
  });

  it('takes any other tool named after MCP as a discovery, so an unknown one does not slip through', () => {
    expect(mcpViolation(call('ListMcpServers'), 'implementer', [])).toContain('(ListMcpServers)');
    expect(mcpViolation(call('ListMcpServers'), 'po', APP)).toBeUndefined();
  });

  it('lets everything else run', () => {
    expect(mcpViolation(call('Read'), 'implementer', [])).toBeUndefined();
    expect(mcpViolation({ type: 'text', text: 'mcp' }, 'implementer', [])).toBeUndefined();
  });
});
