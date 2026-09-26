import { greet } from '../index';

describe('greet', () => {
  it('greets by name', () => {
    expect(greet('Ada')).toBe('Hello, Ada!');
  });
  it('rejects blank names', () => {
    expect(() => greet('  ')).toThrow('name must not be empty');
  });
});
