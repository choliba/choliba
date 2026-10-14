import type { AgentEvent, McpUse } from '../../../common/interfaces/event.interface';
import { permissionContext, toolRequest } from '../../../agents/runs/tool-request';

function call(name: string, mcp?: McpUse): AgentEvent {
  return { type: 'tool-call', id: 'c1', name, summary: '', ...(mcp === undefined ? {} : { mcp }) };
}

const CONTEXT = { mode: 'execute' } as const;

describe('toolRequest', () => {
  it('asks to invoke a built-in tool, with no server, as the agent', () => {
    expect(toolRequest(call('Task'), 'implementer', CONTEXT)).toEqual({
      subject: { kind: 'agent', id: 'implementer' },
      action: 'invoke',
      object: { kind: 'tool', name: 'Task' },
      context: CONTEXT,
    });
  });

  it('asks to invoke the tool of an MCP server, not the provider tool that carried the call', () => {
    const request = toolRequest(call('Mcp', { kind: 'call', server: 'issues', tool: 'get_issue' }), 'po', CONTEXT);
    expect(request?.object).toEqual({ kind: 'tool', server: 'issues', name: 'get_issue' });
  });

  it('asks nothing for a discovery of MCP tools, named so or told so by the parser, nor for another event', () => {
    expect(toolRequest(call('GetMcpTools', { kind: 'discovery' }), 'po', CONTEXT)).toBeUndefined();
    expect(
      toolRequest(call('ListMcpResourcesTool', { kind: 'discovery', server: 'issues' }), 'po', CONTEXT),
    ).toBeUndefined();
    expect(toolRequest(call('mcp_list_servers'), 'po', CONTEXT)).toBeUndefined();
    expect(toolRequest({ type: 'text', text: 'oi' }, 'po', CONTEXT)).toBeUndefined();
  });
});

describe('permissionContext', () => {
  it('carries the mode and, when there is one, the project name', () => {
    expect(permissionContext({ mode: 'plan' })).toEqual({ mode: 'plan' });
    const project = { name: 'app', baseURL: 'http://x', agentBaseURL: 'http://x', appDir: '/app' };
    expect(permissionContext({ mode: 'execute', project })).toEqual({ mode: 'execute', project: 'app' });
  });
});
