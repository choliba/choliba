import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentEvent } from '../../../runs/interfaces/event.interface';
import { cursorProvider } from '../../helpers/providers';
import { cursorToolName, parseCursorToolCall } from '../../../providers/cursor/tool-calls';
import { renderEvent } from '../../../runs/render';

const FIXTURE = join(__dirname, '..', '..', 'fixtures', 'streams', 'cursor-tool-calls.jsonl');

function parseFixture(): AgentEvent[] {
  const parser = cursorProvider.createParser();
  return readFileSync(FIXTURE, 'utf8')
    .split('\n')
    .flatMap((line) => [...parser.parseLine(line)]);
}

describe('cursor tool calls', () => {
  it('turns a real cursor stream into the same tool events and terminal lines as claude', () => {
    const lines = parseFixture()
      .filter((event) => event.type === 'tool-call' || event.type === 'tool-result')
      .map((event) => renderEvent(event, { label: 'agent', colorize: false }))
      .filter((line): line is string => line !== undefined);

    expect(lines).toEqual(
      expect.arrayContaining([
        '[agent] → Read: /workspace/src/a.ts',
        '[agent] → Grep: export const',
        '[agent] → Glob: src/*.ts',
        '[agent] → Shell: ls src',
        '[agent] → Shell: echo blocked',
        '[agent] → Edit: /workspace/notes.md',
        '[agent] → Edit: /workspace/locked/x.md',
        '[agent] ✗ Shell ls src: negado (comando fora de allow.execute)',
        '[agent] ✗ Shell echo blocked: negado (comando fora de allow.execute)',
        '[agent] ✗ Edit /workspace/locked/x.md: negado (escrita fora de allow.write)',
        // The completed Read repeats no path: the line takes it from the started call.
        '[agent] ✗ Read /workspace/nao-existe.txt: erro: File not found',
        '[agent] ✗ Read /workspace/secreto/s.txt: negado (leitura fora de allow.read)',
      ]),
    );
    // Successful calls stay quiet, as they do for claude.
    expect(lines.filter((line) => line.includes('✗'))).toHaveLength(5);
  });

  it('pairs results with their call ids', () => {
    const events = parseFixture();
    const denied = events.find((event) => event.type === 'tool-result' && event.text.startsWith('Command blocked'));
    const call = events.find((event) => event.type === 'tool-call' && event.summary === 'echo blocked');

    expect(denied).toMatchObject({ name: 'Shell', denied: true, isError: true });
    expect(call).toBeDefined();
    expect(denied?.type === 'tool-result' && call?.type === 'tool-call' && denied.id === call.id).toBe(true);
  });
});

describe('parseCursorToolCall', () => {
  it('ignores malformed events, the plan call and unknown subtypes', () => {
    expect(parseCursorToolCall({ type: 'tool_call' })).toEqual([]);
    expect(parseCursorToolCall({ type: 'tool_call', tool_call: {} })).toEqual([]);
    expect(parseCursorToolCall({ type: 'tool_call', tool_call: { readToolCall: 'x' } })).toEqual([]);
    expect(
      parseCursorToolCall({ tool_call: { createPlanToolCall: { args: { plan: 'p' } } }, subtype: 'started' }),
    ).toEqual([]);
    expect(parseCursorToolCall({ tool_call: { readToolCall: {} }, subtype: 'updated' })).toEqual([]);
    expect(parseCursorToolCall({ tool_call: { readToolCall: {} }, subtype: 'completed' })).toEqual([]);
  });

  it('copes with missing ids, args and error details', () => {
    expect(parseCursorToolCall({ tool_call: { fooToolCall: {} }, subtype: 'started' })).toEqual([
      { type: 'tool-call', id: '', name: 'Foo', summary: '' },
    ]);
    expect(
      parseCursorToolCall({
        call_id: 'c',
        tool_call: { fooToolCall: { result: { error: 'x' } } },
        subtype: 'completed',
      }),
    ).toEqual([{ type: 'tool-result', id: 'c', name: 'Foo', isError: true, denied: false, text: 'x' }]);
    expect(
      parseCursorToolCall({
        tool_call: { fooToolCall: { result: { error: { reason: 'why' } } } },
        subtype: 'completed',
      }),
    ).toEqual([{ type: 'tool-result', id: '', name: 'Foo', isError: true, denied: false, text: 'why' }]);
    // Read reports both a missing file and a denied path as an `error` with `errorMessage` (real stream, 2026.10.01).
    const readError = (errorMessage: string) =>
      parseCursorToolCall({
        tool_call: { readToolCall: { result: { error: { errorMessage } } } },
        subtype: 'completed',
      });
    expect(readError('File not found')).toEqual([
      { type: 'tool-result', id: '', name: 'Read', isError: true, denied: false, text: 'File not found' },
    ]);
    expect(readError('Permission denied')).toEqual([
      { type: 'tool-result', id: '', name: 'Read', isError: true, denied: true, text: 'Permission denied' },
    ]);
    expect(
      parseCursorToolCall({
        tool_call: { fooToolCall: { result: { error: { error: { message: 'deep' } } } } },
        subtype: 'completed',
      }),
    ).toEqual([{ type: 'tool-result', id: '', name: 'Foo', isError: true, denied: false, text: 'deep' }]);
    expect(parseCursorToolCall({ tool_call: { fooToolCall: { result: {} } }, subtype: 'completed' })).toEqual([
      { type: 'tool-result', id: '', name: 'Foo', isError: true, denied: false, text: '' },
    ]);
  });

  it('names tools after their key', () => {
    expect(cursorToolName('readToolCall')).toBe('Read');
    expect(cursorToolName('semSearch')).toBe('SemSearch');
  });

  // The shapes below come from a real cursor-agent stream (2026.10.01), trimmed to the fields that matter.
  it('says which MCP tool a call uses: toolName of serverIdentifier, or of providerIdentifier', () => {
    const started = (args: Record<string, unknown>) => ({
      type: 'tool_call',
      subtype: 'started',
      call_id: 'c1',
      tool_call: { mcpToolCall: { args } },
    });
    const call = {
      name: 'git-git_status',
      args: { repo_path: '/repo' },
      providerIdentifier: 'git',
      toolName: 'git_status',
      serverIdentifier: 'git',
    };

    expect(parseCursorToolCall(started(call))).toEqual([
      {
        type: 'tool-call',
        id: 'c1',
        name: 'Mcp',
        summary: '',
        mcp: { kind: 'call', server: 'git', tool: 'git_status' },
      },
    ]);
    expect(parseCursorToolCall(started({ providerIdentifier: 'mcp-app', toolName: 'get_issue' }))[0]).toMatchObject({
      mcp: { kind: 'call', server: 'mcp-app', tool: 'get_issue' },
    });
    // Without a tool name it cannot be checked as a call: it is taken as a look at the server.
    expect(parseCursorToolCall(started({ serverIdentifier: 'git' }))[0]).toMatchObject({
      mcp: { kind: 'discovery', server: 'git' },
    });
  });

  it("takes GetMcpTools as a discovery, and Cursor's own catalog (server cursor) as one of no particular server", () => {
    const started = (args: Record<string, unknown>) => ({
      type: 'tool_call',
      subtype: 'started',
      call_id: 'c2',
      tool_call: { getMcpToolsToolCall: { args: { toolCallId: 'c2', ...args } } },
    });

    expect(parseCursorToolCall(started({}))).toEqual([
      { type: 'tool-call', id: 'c2', name: 'GetMcpTools', summary: '', mcp: { kind: 'discovery' } },
    ]);
    expect(parseCursorToolCall(started({ pattern: 'git' }))[0]).toMatchObject({
      summary: 'git',
      mcp: { kind: 'discovery' },
    });
    expect(parseCursorToolCall(started({ server: 'cursor', toolName: 'FetchMcpResource' }))[0]).toMatchObject({
      mcp: { kind: 'discovery' },
    });
    expect(parseCursorToolCall(started({ server: 'cursor' }))[0]?.mcp).not.toHaveProperty('server');
    expect(parseCursorToolCall(started({ server: 'mcp-app' }))[0]).toMatchObject({
      mcp: { kind: 'discovery', server: 'mcp-app' },
    });
  });

  it('names a subagent call Task, which the run stops on', () => {
    const started = {
      type: 'tool_call',
      subtype: 'started',
      call_id: 'c1',
      tool_call: { taskToolCall: { args: { description: 'investigar a falha' } } },
    };

    expect(parseCursorToolCall(started)).toEqual([{ type: 'tool-call', id: 'c1', name: 'Task', summary: '' }]);
  });
});

describe('cursor plan call', () => {
  it('emits the plan once, from started, even though completed repeats it', () => {
    const parser = cursorProvider.createParser();
    const event = (subtype: string): string =>
      JSON.stringify({
        type: 'tool_call',
        subtype,
        call_id: 'p',
        tool_call: { createPlanToolCall: { args: { plan: '# Plano' } } },
      });

    expect(parser.parseLine(event('started'))).toEqual([{ type: 'plan', markdown: '# Plano' }]);
    expect(parser.parseLine(event('completed'))).toEqual([]);
  });
});
