import { fieldHistory } from '../../panel/panel-history';

describe('fieldHistory', () => {
  it('goes back from the last message on an empty field, stops at the first, and empties the field past the last', () => {
    const history = fieldHistory();
    for (const text of ['a', 'b', 'b', 'c']) history.record(text);

    expect(history.step('', -1)).toBe('c');
    expect(history.step('c', -1)).toBe('b');
    expect(history.step('b', -1)).toBe('a');
    expect(history.step('a', -1)).toBe('a');
    expect(history.step('a', 1)).toBe('b');
    expect(history.step('b', 1)).toBe('c');
    expect(history.step('c', 1)).toBe('');
    expect(history.step('', 1)).toBeUndefined();
  });

  it('is not for a field with something typed, an edited message, nor while nothing was sent', () => {
    const history = fieldHistory();
    expect(history.step('', -1)).toBeUndefined();
    history.record('a');

    expect(history.step('digitado', -1)).toBeUndefined();
    expect(history.step('', -1)).toBe('a');
    expect(history.step('a!', -1)).toBeUndefined();
    expect(history.step('', -1)).toBe('a');
    history.record('b');
    expect(history.step('', -1)).toBe('b');
  });

  it('keeps only the last messages', () => {
    const history = fieldHistory(2);
    for (const text of ['a', 'b', 'c']) history.record(text);

    expect([history.step('', -1), history.step('c', -1), history.step('b', -1)]).toEqual(['c', 'b', 'b']);
  });
});
