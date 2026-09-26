import { formatDuration } from '../format-duration';

describe('formatDuration', () => {
  it('formats sub-second durations in milliseconds', () => {
    expect(formatDuration(250)).toBe('250ms');
  });

  it('formats longer durations in seconds', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });
});
