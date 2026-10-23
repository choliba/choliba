import type { AgentEvent } from '../../ports';
import {
  defaultResolvePlanContent,
  isSubstantiveAgentEvent,
  modelReportMissingMessage,
  validateModelReportMissing,
  validateReportedModel,
} from '../../runs/run-event';

const context = { providerId: 'local', agentName: 'reviewer' };

describe('run events', () => {
  it('recognizes only work events as substantive', () => {
    const text: AgentEvent = { type: 'text', text: 'done' };
    const tool: AgentEvent = { type: 'tool-call', id: '1', name: 'read', summary: 'file' };
    const init: AgentEvent = { type: 'init', model: 'small', sessionId: undefined };
    expect([text, tool, init].map(isSubstantiveAgentEvent)).toEqual([true, true, false]);
  });

  it('validates a reported model against the declaration', () => {
    expect(validateReportedModel('small', [], context)).toBeUndefined();
    expect(validateReportedModel('small', ['small'], context)).toBeUndefined();
    expect(validateReportedModel('large', ['small'], context)).toContain('Supported: small');
    expect(modelReportMissingMessage(['small'], context)).toContain('requires one of: small');
    expect(validateModelReportMissing([], context)).toBeUndefined();
    expect(validateModelReportMissing(['small'], context)).toContain('requires one of: small');
  });

  it('chooses the first non-empty plan content', () => {
    const done = { type: 'done', isError: false, text: 'answer' } as const;
    expect(defaultResolvePlanContent({ planMarkdown: 'plan', doneEvent: done, textParts: ['text'] })).toBe('plan');
    expect(defaultResolvePlanContent({ planMarkdown: ' ', doneEvent: done, textParts: ['text'] })).toBe('answer');
    expect(defaultResolvePlanContent({ planMarkdown: undefined, doneEvent: undefined, textParts: [] })).toBeUndefined();
  });
});
