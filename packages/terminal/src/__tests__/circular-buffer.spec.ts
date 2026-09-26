import { CircularBuffer } from '../circular-buffer';

describe('CircularBuffer', () => {
  it('rejects a non-positive capacity', () => {
    expect(() => new CircularBuffer(0)).toThrow('capacity must be a positive integer, got 0');
    expect(() => new CircularBuffer(-1)).toThrow(/positive integer/);
  });

  it('rejects a non-integer capacity', () => {
    expect(() => new CircularBuffer(1.5)).toThrow(/positive integer/);
  });

  it('starts empty', () => {
    const buffer = new CircularBuffer<number>(3);

    expect(buffer.size).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it('keeps chronological order while under capacity', () => {
    const buffer = new CircularBuffer<number>(3);

    buffer.push(1);
    buffer.push(2);

    expect(buffer.size).toBe(2);
    expect(buffer.toArray()).toEqual([1, 2]);
  });

  it('drops the oldest item once capacity is exceeded, keeping chronological order', () => {
    const buffer = new CircularBuffer<number>(3);

    buffer.push(1);
    buffer.push(2);
    buffer.push(3);
    buffer.push(4);
    buffer.push(5);

    expect(buffer.size).toBe(3);
    expect(buffer.toArray()).toEqual([3, 4, 5]);
  });

  it('handles a capacity of exactly one', () => {
    const buffer = new CircularBuffer<string>(1);

    buffer.push('a');
    buffer.push('b');

    expect(buffer.toArray()).toEqual(['b']);
  });
});
