import { messageOf } from '../../cli';

describe('messageOf', () => {
  it("is an Error's message, or the thrown value as text", () => {
    expect(messageOf(new Error('quebrou'))).toBe('quebrou');
    expect(messageOf('texto solto')).toBe('texto solto');
    expect(messageOf(3)).toBe('3');
  });
});
