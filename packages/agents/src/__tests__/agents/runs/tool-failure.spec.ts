import type { AgentEvent } from '../../../common/interfaces/event.interface';
import { failureLine } from '../../../agents/runs/tool-failure';

type ToolResult = Extract<AgentEvent, { type: 'tool-result' }>;

function failed(name: string | undefined, overrides: Partial<ToolResult> = {}): ToolResult {
  return { type: 'tool-result', id: 't', name, isError: true, denied: true, text: '', ...overrides };
}

describe('failureLine', () => {
  it.each([
    ['Read', '/w/a.ts', 'leitura fora de allow.read'],
    ['Grep', 'export', 'leitura fora de allow.read'],
    ['Glob', 'src/*.ts', 'leitura fora de allow.read'],
    ['LS', '/w', 'leitura fora de allow.read'],
    ['Write', '/w/a.ts', 'escrita fora de allow.write'],
    ['Edit', '/w/a.ts', 'escrita fora de allow.write'],
    ['MultiEdit', '/w/a.ts', 'escrita fora de allow.write'],
    ['NotebookEdit', '/w/a.ipynb', 'escrita fora de allow.write'],
    ['Delete', '/w/a.ts', 'escrita fora de allow.write'],
    ['Bash', 'bun install', 'comando fora de allow.execute'],
    ['Shell', 'bun install', 'comando fora de allow.execute'],
  ])('says which agent.yaml key a denied %s needs', (name, target, why) => {
    expect(failureLine(failed(name, { target }))).toBe(`${name} ${target}: negado (${why})`);
  });

  it('names the server and tool of a denied MCP call, and any MCP use as outside mcps', () => {
    expect(failureLine(failed('Mcp', { mcp: { kind: 'call', server: 'git', tool: 'git_status' } }))).toBe(
      'Mcp git:git_status: negado (MCP fora de mcps)',
    );
    expect(failureLine(failed('GetMcpTools', { target: 'git', mcp: { kind: 'discovery' } }))).toBe(
      'GetMcpTools git: negado (MCP fora de mcps)',
    );
  });

  it('says a tool outside the table is denied by the permissions, without a target when there is none', () => {
    expect(failureLine(failed('WebFetch'))).toBe('WebFetch: negado (pelas permissões do agent.yaml)');
    expect(failureLine(failed(undefined))).toBe('?: negado (pelas permissões do agent.yaml)');
  });

  it("gives the first line of the tool's own error, or says the provider gave none", () => {
    expect(failureLine(failed('Read', { denied: false, target: '/w/x', text: 'File not found\nstack' }))).toBe(
      'Read /w/x: erro: File not found',
    );
    expect(failureLine(failed('Read', { denied: false, text: '  ' }))).toBe(
      'Read: erro (o provider não disse o motivo)',
    );
  });
});
