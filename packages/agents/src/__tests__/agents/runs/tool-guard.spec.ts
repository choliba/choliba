import type { McpDeclaration } from '../../../common/interfaces/agent.interface';
import type { ProviderRequest } from '../../../common/interfaces/provider.interface';
import type { AgentEvent, McpUse } from '../../../common/interfaces/event.interface';
import { readAgentPermissions } from '../../../common/agent-permissions';
import { pathPolicy } from '../../../common/path-policy';
import { toolGuard, toolViolation, type ToolGuard } from '../../../../../engine/src/guards/tool-guard';
import { toolPolicy } from '../../../../../engine/src/guards/tool-policy';

function call(name: string, mcp?: McpUse, summary = ''): AgentEvent {
  return { type: 'tool-call', id: 'c1', name, summary, ...(mcp === undefined ? {} : { mcp }) };
}

function guard(agent: string, mcps: readonly McpDeclaration[], unenforcedTools: readonly string[] = []): ToolGuard {
  return {
    agent,
    mcps,
    context: { mode: 'execute' },
    policy: { path: pathPolicy(readAgentPermissions({})), tool: toolPolicy(mcps, unenforcedTools) },
  };
}

const APP = [{ name: 'issues', tools: ['get_issue'] }];
const ANY_GIT = [{ name: 'git' }];

describe('toolViolation', () => {
  it('stops a call to a subagent, in any mode, naming the tool', () => {
    expect(toolViolation(call('Agent'), guard('po', APP))).toBe(
      '✗ o agente tentou delegar a um subagente (Agent); a execução foi interrompida: nenhum agente do choliba delega trabalho.',
    );
    const planning = { ...guard('po', APP), context: { mode: 'plan' } } as const;
    expect(toolViolation(call('Task'), planning)).toContain('(Task)');
  });

  it('stops a built-in tool the provider cannot limit, and lets any other built-in run', () => {
    expect(toolViolation(call('Grep'), guard('po', [], ['Grep']))).toBe(
      '✗ o agente usou Grep, que as permissões deste provider não conseguem limitar; a execução foi interrompida.',
    );
    expect(toolViolation(call('Read'), guard('po', [], ['Grep']))).toBeUndefined();
  });

  it('stops any MCP use in an agent that declares none, naming what it tried', () => {
    expect(toolViolation(call('GetMcpTools', { kind: 'discovery' }), guard('implementer', []))).toBe(
      '✗ o agente tentou usar um MCP não declarado (GetMcpTools); a execução foi interrompida: implementer declara nenhum MCP em agent.yaml#mcps.',
    );
    expect(
      toolViolation(call('Mcp', { kind: 'call', server: 'git', tool: 'log' }), guard('implementer', [])),
    ).toContain('(git:log)');
  });

  it('lets a declared server be called, within the tools it lists', () => {
    expect(
      toolViolation(call('Mcp', { kind: 'call', server: 'issues', tool: 'get_issue' }), guard('po', APP)),
    ).toBeUndefined();
    expect(
      toolViolation(call('Mcp', { kind: 'call', server: 'git', tool: 'anything' }), guard('po', ANY_GIT)),
    ).toBeUndefined();
    expect(toolViolation(call('Mcp', { kind: 'call', server: 'issues', tool: 'delete_issue' }), guard('po', APP))).toBe(
      '✗ o agente tentou usar uma tool que po não declara (issues:delete_issue); a execução foi interrompida: issues declara get_issue em agent.yaml#mcps.issues.tools.',
    );
    expect(toolViolation(call('Mcp', { kind: 'call', server: 'git', tool: 'log' }), guard('po', APP))).toBe(
      '✗ o agente tentou usar um MCP não declarado (git:log); a execução foi interrompida: po declara issues em agent.yaml#mcps.',
    );
  });

  it('keeps a declared server apart from a built-in of the same name', () => {
    expect(toolViolation(call('get_issue'), guard('po', APP))).toBeUndefined();
    expect(toolViolation(call('Mcp', { kind: 'call', server: 'issues', tool: 'Task' }), guard('po', APP))).toContain(
      '(issues:Task)',
    );
  });

  it('lets an agent that declares MCPs look for tools, but not in a server it does not declare', () => {
    expect(toolViolation(call('GetMcpTools', { kind: 'discovery' }), guard('po', APP))).toBeUndefined();
    expect(
      toolViolation(call('ListMcpResourcesTool', { kind: 'discovery', server: 'issues' }), guard('po', APP)),
    ).toBeUndefined();
    expect(
      toolViolation(call('ListMcpResourcesTool', { kind: 'discovery', server: 'git' }), guard('po', APP)),
    ).toContain('(ListMcpResourcesTool em git)');
  });

  it('takes any other tool named after MCP as a discovery, so an unknown one does not slip through', () => {
    expect(toolViolation(call('ListMcpServers'), guard('implementer', []))).toContain('(ListMcpServers)');
    expect(toolViolation(call('ListMcpServers'), guard('po', APP))).toBeUndefined();
  });

  it('lets everything else run', () => {
    expect(toolViolation(call('Read'), guard('implementer', []))).toBeUndefined();
    expect(toolViolation({ type: 'text', text: 'mcp' }, guard('implementer', []))).toBeUndefined();
  });
});

describe('toolGuard', () => {
  const request = {
    agent: {
      name: 'implementer',
      mcps: [],
      permissions: readAgentPermissions({ allow: { execute: { './': ['git status'] } } }),
    },
    mode: 'execute',
    policy: 'edits',
    workspaceRoot: '/repo',
    runDir: '/repo/.cache/runs/x',
  } as unknown as ProviderRequest;

  it("checks each command against the agent's execute rules when the provider cannot limit them", () => {
    const guard = toolGuard(request, { unenforcedTools: [], enforcesExecute: false });

    expect(toolViolation(call('Bash', undefined, "/bin/bash -lc 'git status'"), guard)).toBeUndefined();
    expect(toolViolation(call('Bash', undefined, 'rm -rf /'), guard)).toContain('rodou rm -rf /');
    expect(toolViolation(call('Edit', undefined, 'rm -rf /'), guard)).toBeUndefined();
  });

  it('leaves the commands to a provider that limits them', () => {
    const guard = toolGuard(request, { unenforcedTools: ['Grep'], enforcesExecute: true });

    expect(guard.commands).toBeUndefined();
    expect(toolViolation(call('Bash', undefined, 'rm -rf /'), guard)).toBeUndefined();
    expect(toolViolation(call('Grep'), guard)).toContain('Grep');
  });
});
