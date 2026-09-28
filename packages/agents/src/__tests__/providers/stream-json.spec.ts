import type { AgentEvent } from '../../events.types';
import {
  createStreamJsonParser,
  defaultResolvePlanContent,
  extractCreatePlanToolPlan,
  isSubstantiveAgentEvent,
  parseInitEvent,
  validateExplicitModel,
  validateModelReportMissing,
  validateReportedModel,
} from '../../providers/stream-json';

function line(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

describe('parseInitEvent', () => {
  it('parses claude system/init', () => {
    expect(parseInitEvent({ type: 'system', subtype: 'init', model: 'sonnet-5', session_id: 'abc' })).toEqual({
      type: 'init',
      model: 'sonnet-5',
      sessionId: 'abc',
    });
  });

  it('parses cursor flat init', () => {
    expect(parseInitEvent({ type: 'init', model: 'gpt-5', session_id: 'xyz' })).toEqual({
      type: 'init',
      model: 'gpt-5',
      sessionId: 'xyz',
    });
  });

  it('parses cursor-agent real stream init (system/subtype, same shape as claude)', () => {
    expect(
      parseInitEvent({
        type: 'system',
        subtype: 'init',
        model: 'Composer 2.5 Fast',
        session_id: 'deb5dbe4-e956-47e3-b4de-5b75d6b98b5d',
      }),
    ).toEqual({
      type: 'init',
      model: 'Composer 2.5 Fast',
      sessionId: 'deb5dbe4-e956-47e3-b4de-5b75d6b98b5d',
    });
  });

  it('accepts model_id and sessionId aliases', () => {
    expect(parseInitEvent({ type: 'init', model_id: 'm1', sessionId: 's1' })).toEqual({
      type: 'init',
      model: 'm1',
      sessionId: 's1',
    });
  });

  it('returns undefined for non-init events', () => {
    expect(parseInitEvent({ type: 'assistant' })).toBeUndefined();
    expect(parseInitEvent({ type: 'system', subtype: 'other' })).toBeUndefined();
  });
});

describe('model guards', () => {
  const supported = ['sonnet-5', 'gpt-4o'];

  it('validateExplicitModel passes when the model is listed', () => {
    expect(validateExplicitModel('sonnet-5', supported, 'echo')).toBeUndefined();
  });

  it('validateExplicitModel passes when supported_models is empty', () => {
    expect(validateExplicitModel('anything', [], 'echo')).toBeUndefined();
  });

  it('validateExplicitModel rejects unknown models', () => {
    expect(validateExplicitModel('opus-9', supported, 'echo')).toContain('opus-9');
  });

  it('validateReportedModel rejects unknown reported models', () => {
    expect(validateReportedModel('opus-9', supported, { providerId: 'claude', agentName: 'echo' })).toContain(
      'Stopping',
    );
  });

  it('validateModelReportMissing fires when supported_models is non-empty', () => {
    expect(validateModelReportMissing(supported, { providerId: 'cursor', agentName: 'echo' })).toContain(
      'did not report a model',
    );
  });

  it('validateModelReportMissing is silent when supported_models is empty', () => {
    expect(validateModelReportMissing([], { providerId: 'cursor', agentName: 'echo' })).toBeUndefined();
  });
});

describe('isSubstantiveAgentEvent', () => {
  it.each<[AgentEvent, boolean]>([
    [{ type: 'text', text: 'hi' }, true],
    [{ type: 'tool-call', id: '1', name: 'Read', summary: '' }, true],
    [{ type: 'init', model: 'm', sessionId: 's' }, false],
    [{ type: 'done', isError: false, text: '' }, false],
  ])('%#', (event, expected) => {
    expect(isSubstantiveAgentEvent(event)).toBe(expected);
  });
});

describe('createStreamJsonParser', () => {
  it('tracks sawInitWithModel only when init carries a model', () => {
    const parser = createStreamJsonParser({ planFromExitPlanMode: false });
    expect(parser.sawInitWithModel).toBe(false);
    parser.parseLine(line({ type: 'init', session_id: 'x' }));
    expect(parser.sawInitWithModel).toBe(false);
    parser.parseLine(line({ type: 'init', model: 'gpt-5', session_id: 'x' }));
    expect(parser.sawInitWithModel).toBe(true);
  });

  it('parses assistant blocks like both providers', () => {
    const events = createStreamJsonParser({ planFromExitPlanMode: false }).parseLine(
      line({
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'hi' },
            { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: 'a.ts' } },
          ],
        },
      }),
    );

    expect(events).toEqual([
      { type: 'text', text: 'hi' },
      { type: 'tool-call', id: 't1', name: 'Read', summary: 'a.ts' },
    ]);
  });

  it('extractCreatePlanToolPlan reads nested createPlanToolCall args', () => {
    expect(
      extractCreatePlanToolPlan({
        type: 'tool_call',
        tool_call: { createPlanToolCall: { args: { plan: '## Step 1' } } },
      }),
    ).toBe('## Step 1');
    expect(extractCreatePlanToolPlan({ type: 'tool_call', tool_call: 'bad' })).toBeUndefined();
    expect(extractCreatePlanToolPlan({ type: 'tool_call', tool_call: {} })).toBeUndefined();
    expect(
      extractCreatePlanToolPlan({
        type: 'tool_call',
        tool_call: { createPlanToolCall: { args: 'bad' } },
      }),
    ).toBeUndefined();
  });

  it('defaultResolvePlanContent skips blank values and falls back in order', () => {
    expect(
      defaultResolvePlanContent({
        planMarkdown: '   ',
        doneEvent: { type: 'done', isError: false, text: 'from done' },
        textParts: ['ignored'],
      }),
    ).toBe('from done');
    expect(
      defaultResolvePlanContent({
        planMarkdown: undefined,
        doneEvent: undefined,
        textParts: [],
      }),
    ).toBeUndefined();
  });

  it('emits plan events from createPlanToolCall only when enabled', () => {
    const payload = line({
      type: 'tool_call',
      subtype: 'started',
      call_id: 'p1',
      tool_call: { createPlanToolCall: { args: { plan: '## Step 1\nDo x' } } },
    });

    expect(createStreamJsonParser({ planFromExitPlanMode: false }).parseLine(payload)).toEqual([]);
    expect(
      createStreamJsonParser({ planFromExitPlanMode: false, planFromCreatePlanToolCall: true }).parseLine(payload),
    ).toEqual([{ type: 'plan', markdown: '## Step 1\nDo x' }]);
  });

  it('ignores tool_call lines without createPlanToolCall even when enabled', () => {
    expect(
      createStreamJsonParser({ planFromExitPlanMode: false, planFromCreatePlanToolCall: true }).parseLine(
        line({ type: 'tool_call', subtype: 'started', tool_call: { readToolCall: {} } }),
      ),
    ).toEqual([]);
  });

  it('defaultResolvePlanContent prefers plan events over done narration', () => {
    expect(
      defaultResolvePlanContent({
        planMarkdown: '## Real plan',
        doneEvent: { type: 'done', isError: false, text: 'Creating the plan...' },
        textParts: ['Analyzing...'],
      }),
    ).toBe('## Real plan');
  });

  it('emits plan events from ExitPlanMode only when enabled', () => {
    const payload = line({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: 'p1', name: 'ExitPlanMode', input: { plan: '1. step' } }],
      },
    });

    expect(createStreamJsonParser({ planFromExitPlanMode: false }).parseLine(payload)).toEqual([
      { type: 'tool-call', id: 'p1', name: 'ExitPlanMode', summary: '' },
    ]);
    expect(createStreamJsonParser({ planFromExitPlanMode: true }).parseLine(payload)).toEqual([
      { type: 'tool-call', id: 'p1', name: 'ExitPlanMode', summary: '' },
      { type: 'plan', markdown: '1. step' },
    ]);
  });
});
