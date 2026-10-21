import { closest, unknownWordMessage } from '../../help';

describe('closest', () => {
  it('finds the candidate a typo most likely meant', () => {
    expect(closest('testdddd', ['run', 'add', 'tests', 'check'])).toBe('tests');
    expect(closest('ad', ['run', 'add'])).toBe('add');
    expect(closest('chek', ['check', 'setup'])).toBe('check');
  });

  it('finds nothing when every candidate is far, and keeps the first on a tie', () => {
    expect(closest('xyz', ['run', 'add'])).toBeUndefined();
    expect(closest('ab', ['aa', 'bb'])).toBe('aa');
    expect(closest('x', [])).toBeUndefined();
  });
});

describe('unknownWordMessage', () => {
  it('suggests the closest word, or says only what was wrong', () => {
    expect(unknownWordMessage('tipo desconhecido', 'test', ['agent', 'tests'])).toBe(
      'tipo desconhecido: test. Você quis dizer "tests"?',
    );
    expect(unknownWordMessage('comando desconhecido', 'zzzzzz', ['run'])).toBe('comando desconhecido: zzzzzz.');
  });
});
