import { asBoolean, asString, asStringArray, isRecord, parseJsonLine } from '../../shared/json';

describe('isRecord', () => {
  it('accepts a plain object', () => {
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('rejects null, arrays and primitives', () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(1)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('asString', () => {
  it('passes a string through', () => {
    expect(asString('hi')).toBe('hi');
  });

  it('rejects everything else', () => {
    expect(asString(1)).toBeUndefined();
    expect(asString(null)).toBeUndefined();
    expect(asString(undefined)).toBeUndefined();
  });
});

describe('asBoolean', () => {
  it('passes a boolean through', () => {
    expect(asBoolean(true)).toBe(true);
    expect(asBoolean(false)).toBe(false);
  });

  it('rejects everything else', () => {
    expect(asBoolean('true')).toBeUndefined();
    expect(asBoolean(1)).toBeUndefined();
  });
});

describe('asStringArray', () => {
  it('passes an array of strings through', () => {
    expect(asStringArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('accepts an empty array', () => {
    expect(asStringArray([])).toEqual([]);
  });

  it('rejects a non-array', () => {
    expect(asStringArray('a')).toBeUndefined();
    expect(asStringArray(undefined)).toBeUndefined();
  });

  it('rejects an array with a non-string element', () => {
    expect(asStringArray(['a', 1])).toBeUndefined();
  });
});

describe('parseJsonLine', () => {
  it('parses a valid JSON object', () => {
    expect(parseJsonLine('{"a":1}')).toEqual({ a: 1 });
  });

  it('trims surrounding whitespace', () => {
    expect(parseJsonLine('  {"a":1}  \n')).toEqual({ a: 1 });
  });

  it('returns undefined for a blank line', () => {
    expect(parseJsonLine('')).toBeUndefined();
    expect(parseJsonLine('   ')).toBeUndefined();
  });

  it('returns undefined for malformed JSON', () => {
    expect(parseJsonLine('not json')).toBeUndefined();
  });
});
