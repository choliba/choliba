import { colorForLabel, formatLine, isAnsiColor, paint } from '../formatter';

describe('colorForLabel', () => {
  it('is stable for the same label', () => {
    expect(colorForLabel('camera-backend')).toBe(colorForLabel('camera-backend'));
  });

  it('can produce different colors for different labels', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((label) => colorForLabel(label)));

    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('formatLine', () => {
  it('prefixes the line with a colored [label] tag and a reset code', () => {
    const line = formatLine('camera-backend', 'hello', { color: 'cyan' });

    expect(line).toBe('\u001b[36m[camera-backend]\u001b[0m hello');
  });

  it('uses a deterministic color for the label when none is given', () => {
    const line = formatLine('camera-backend', 'hello');

    expect(line).toContain('[camera-backend]\u001b[0m');
    expect(line.endsWith('hello')).toBe(true);
  });

  it('preserves ANSI codes already present in the raw line', () => {
    const coloredRaw = '\u001b[32mPASS\u001b[0m test/foo.spec.ts';

    const line = formatLine('go-test', coloredRaw, { color: 'green' });

    expect(line).toContain(coloredRaw);
  });

  it('adds no timestamp by default', () => {
    const line = formatLine('vite', 'ready in 200ms', { color: 'blue' });

    expect(line).toBe('\u001b[34m[vite]\u001b[0m ready in 200ms');
  });

  it('renders the timestamp it is given, and never reads the clock itself', () => {
    const at = new Date('2024-05-05T10:00:00.000Z');

    const line = formatLine('vite', 'ready in 200ms', { color: 'blue', timestamp: at });

    expect(line).toBe('\u001b[34m[vite]\u001b[0m 2024-05-05T10:00:00.000Z ready in 200ms');
  });

  it('is pure: the same arguments always produce the same string', () => {
    const at = new Date('2024-05-05T10:00:00.000Z');
    const options = { color: 'blue', timestamp: at } as const;

    expect(formatLine('vite', 'x', options)).toBe(formatLine('vite', 'x', options));
  });

  it('adds no ANSI of its own when colorize is false', () => {
    const line = formatLine('vite', 'ready', { color: 'blue', colorize: false });

    expect(line).toBe('[vite] ready');
  });

  it('still preserves the child ANSI codes when colorize is false', () => {
    const coloredRaw = '\u001b[32mPASS\u001b[0m test/foo.spec.ts';

    const line = formatLine('go-test', coloredRaw, { colorize: false });

    expect(line).toBe(`[go-test] ${coloredRaw}`);
  });

  it('combines colorize false with a timestamp', () => {
    const line = formatLine('vite', 'ready', { colorize: false, timestamp: new Date('2024-05-05T10:00:00.000Z') });

    expect(line).toBe('[vite] 2024-05-05T10:00:00.000Z ready');
  });
});

describe('paint', () => {
  it('wraps the text in the color and a reset, and knows which names are colors', () => {
    expect(paint('ok', 'green')).toBe('\u001b[32mok\u001b[0m');
    expect(isAnsiColor('red')).toBe(true);
    expect(isAnsiColor('blue')).toBe(true);
    expect(isAnsiColor('review')).toBe(false);
    expect(isAnsiColor('toString')).toBe(false);
  });
});
