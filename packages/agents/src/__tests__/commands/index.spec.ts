import { defineCommand } from '../../commands/index';

describe('commands/index', () => {
  it('re-exports defineCommand for test harnesses', () => {
    expect(typeof defineCommand).toBe('function');
  });
});
