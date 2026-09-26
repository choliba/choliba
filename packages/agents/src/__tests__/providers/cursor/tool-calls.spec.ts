import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AgentEvent } from '../../../events.types';
import { cursorProvider } from '../../../providers/cursor';
import { cursorToolName, parseCursorToolCall } from '../../../providers/cursor/tool-calls';
import { renderEvent } from '../../../render';

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
        '[agent] ✗ Shell (denied): rejected',
        '[agent] ✗ Shell (denied): Command blocked by permissions configuration',
        expect.stringMatching(/^\[agent\] ✗ Edit \(denied\): Write permission denied: \/workspace\/locked\/x\.md/),
      ]),
    );
    // Successful calls stay quiet, as they do for claude.
    expect(lines.filter((line) => line.includes('✗'))).toHaveLength(3);
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
    expect(parseCursorToolCall({ tool_call: { createPlanToolCall: { args: { plan: 'p' } } }, subtype: 'started' })).toEqual(
      [],
    );
    expect(parseCursorToolCall({ tool_call: { readToolCall: {} }, subtype: 'updated' })).toEqual([]);
    expect(parseCursorToolCall({ tool_call: { readToolCall: {} }, subtype: 'completed' })).toEqual([]);
  });

  it('copes with missing ids, args and error details', () => {
    expect(parseCursorToolCall({ tool_call: { fooToolCall: {} }, subtype: 'started' })).toEqual([
      { type: 'tool-call', id: '', name: 'Foo', summary: '' },
    ]);
    expect(
      parseCursorToolCall({ call_id: 'c', tool_call: { fooToolCall: { result: { error: 'x' } } }, subtype: 'completed' }),
    ).toEqual([{ type: 'tool-result', id: 'c', name: 'Foo', isError: true, denied: false, text: 'error' }]);
    expect(parseCursorToolCall({ tool_call: { fooToolCall: { result: { error: { reason: 'why' } } } }, subtype: 'completed' })).toEqual([
      { type: 'tool-result', id: '', name: 'Foo', isError: true, denied: false, text: 'why' },
    ]);
    expect(parseCursorToolCall({ tool_call: { fooToolCall: { result: {} } }, subtype: 'completed' })).toEqual([
      { type: 'tool-result', id: '', name: 'Foo', isError: true, denied: false, text: '' },
    ]);
  });

  it('names tools after their key', () => {
    expect(cursorToolName('readToolCall')).toBe('Read');
    expect(cursorToolName('semSearch')).toBe('SemSearch');
  });
});

describe('cursor plan call', () => {
  it('emits the plan once, from started, even though completed repeats it', () => {
    const parser = cursorProvider.createParser();
    const event = (subtype: string): string =>
      JSON.stringify({ type: 'tool_call', subtype, call_id: 'p', tool_call: { createPlanToolCall: { args: { plan: '# Plano' } } } });

    expect(parser.parseLine(event('started'))).toEqual([{ type: 'plan', markdown: '# Plano' }]);
    expect(parser.parseLine(event('completed'))).toEqual([]);
  });
});
