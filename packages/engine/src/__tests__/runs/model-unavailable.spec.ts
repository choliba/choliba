import { modelUnavailable } from '../../runs/model-unavailable';

describe('modelUnavailable', () => {
  it('knows a model that cannot take a request now, as the providers say it', () => {
    expect(
      [
        'Selected model is at capacity. Please try a different model.',
        'API Error: 529 {"type":"overloaded_error"}',
        'Error: rate limit reached for requests',
        'rate_limited',
        '429 Too Many Requests',
      ].map(modelUnavailable),
    ).toEqual([true, true, true, true, true]);
  });

  it('takes no other failure, nor nothing said, for it', () => {
    expect(['parei: o CA-01 não é testável', 'command not found', ''].map(modelUnavailable)).toEqual([
      false,
      false,
      false,
    ]);
    expect(modelUnavailable(undefined)).toBe(false);
  });
});
