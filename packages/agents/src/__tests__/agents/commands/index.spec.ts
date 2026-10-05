import { defineCommand } from '../../../agents/commands/index';

describe('commands/index', () => {
  it('re-exports defineCommand for test harnesses', () => {
    expect(typeof defineCommand).toBe('function');
  });
});
