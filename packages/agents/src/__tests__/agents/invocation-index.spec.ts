import { defineInvocation } from '../../agents/invocation';

describe('commands/index', () => {
  it('re-exports defineInvocation for test harnesses', () => {
    expect(typeof defineInvocation).toBe('function');
  });
});
