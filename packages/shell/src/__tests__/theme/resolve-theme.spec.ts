import {
  buildTheme,
  colorEnabled,
  colorForLabel,
  ColorsConfigError,
  isAnsiColor,
  paintAnsi,
  parseColors,
  resolveTheme,
} from '../../theme';

const TTY = { env: {}, isTTY: true, noColorFlag: false };

describe('colorEnabled', () => {
  it('is on at a terminal and off in a pipe', () => {
    expect(colorEnabled(TTY)).toBe(true);
    expect(colorEnabled({ ...TTY, isTTY: false })).toBe(false);
  });

  it('is off with --no-color, NO_COLOR or TERM=dumb', () => {
    expect(colorEnabled({ ...TTY, noColorFlag: true })).toBe(false);
    expect(colorEnabled({ ...TTY, env: { NO_COLOR: '1' } })).toBe(false);
    expect(colorEnabled({ ...TTY, env: { TERM: 'dumb' } })).toBe(false);
  });

  it('ignores an empty NO_COLOR', () => {
    expect(colorEnabled({ ...TTY, env: { NO_COLOR: '' } })).toBe(true);
  });

  it('is forced on by FORCE_COLOR, even in a pipe or with TERM=dumb, but not over --no-color or NO_COLOR', () => {
    expect(colorEnabled({ env: { FORCE_COLOR: '1' }, isTTY: false, noColorFlag: false })).toBe(true);
    expect(colorEnabled({ env: { FORCE_COLOR: '1', TERM: 'dumb' }, isTTY: false, noColorFlag: false })).toBe(true);
    expect(colorEnabled({ env: { FORCE_COLOR: '0' }, isTTY: false, noColorFlag: false })).toBe(false);
    // FORCE_COLOR=0 turns color off even at a terminal (how `choliba tests` tells Playwright's process).
    expect(colorEnabled({ env: { FORCE_COLOR: '0' }, isTTY: true, noColorFlag: false })).toBe(false);
    expect(colorEnabled({ env: { FORCE_COLOR: '1' }, isTTY: true, noColorFlag: true })).toBe(false);
    expect(colorEnabled({ env: { FORCE_COLOR: '1', NO_COLOR: '1' }, isTTY: true, noColorFlag: false })).toBe(false);
  });
});

describe('ansi', () => {
  it('derives the same color from the same name, only in base tones', () => {
    expect(colorForLabel('frontend')).toBe(colorForLabel('frontend'));
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map(colorForLabel));
    expect([...colors].every((color) => ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].includes(color))).toBe(
      true,
    );
    expect(colors.size).toBeGreaterThan(1);
  });

  it('knows the supported color names, bright tones included', () => {
    expect(isAnsiColor('gray')).toBe(true);
    expect(isAnsiColor('bright-red')).toBe(true);
    expect(isAnsiColor('white')).toBe(true);
    expect(isAnsiColor('purple')).toBe(false);
    expect(isAnsiColor(3)).toBe(false);
  });

  it('wraps text in the color and a reset', () => {
    expect(paintAnsi('gray', 'x')).toBe('\u001b[90mx\u001b[0m');
    expect(paintAnsi('red', 'x')).toBe('\u001b[31mx\u001b[0m');
    expect(paintAnsi('bright-red', 'x')).toBe('\u001b[91mx\u001b[0m');
  });
});

describe('buildTheme', () => {
  const theme = buildTheme({ agents: { implementer: 'red' } }, true);

  it('prefers the workspace choice, then the declared color, then the default, then the name', () => {
    expect(theme.colorOf('agents', 'implementer', 'blue')).toBe('red');
    expect(theme.colorOf('agents', 'test-writer', 'blue')).toBe('blue');
    expect(theme.colorOf('agents', 'test-writer')).toBe('red');
    expect(theme.colorOf('agents', 'someone-else')).toBe(colorForLabel('someone-else'));
  });

  it('paints only when enabled', () => {
    expect(theme.paint('states', 'error', 'falhou')).toBe('\u001b[91mfalhou\u001b[0m');
    expect(buildTheme({}, false).paint('states', 'error', 'falhou')).toBe('falhou');
  });
});

describe('parseColors', () => {
  it('reads papel.nome=cor items, separated by commas, ignoring spaces and empty items', () => {
    expect(parseColors(' providers.claude=blue , agents.test-writer = bright-red,,agents.implementer=green ')).toEqual({
      providers: { claude: 'blue' },
      agents: { 'test-writer': 'bright-red', implementer: 'green' },
    });
  });

  it('chooses nothing when unset or blank', () => {
    expect(parseColors(undefined)).toEqual({});
    expect(parseColors('  ')).toEqual({});
  });

  it.each([
    ['agents=red', '"agents=red" deve ser papel.nome=cor'],
    ['agents.implementer', '"agents.implementer" deve ser papel.nome=cor'],
    ['colors.a=red', '"colors" não é um papel'],
    ['agents.implementer=purple', 'agents.implementer=purple não é uma cor'],
  ])('rejects %j naming the variable', (value, message) => {
    expect(() => parseColors(value)).toThrow(ColorsConfigError);
    expect(() => parseColors(value)).toThrow(`CHOL_COLORS: `);
    expect(() => parseColors(value)).toThrow(message);
  });
});

describe('resolveTheme', () => {
  it('uses CHOL_COLORS of the configuration over the defaults', () => {
    const theme = resolveTheme({ CHOL_COLORS: 'providers.claude=green' }, TTY);
    expect(theme.enabled).toBe(true);
    expect(theme.colorOf('providers', 'claude')).toBe('green');
    expect(theme.colorOf('providers', 'cursor')).toBe('cyan');
  });

  it('uses only the defaults without CHOL_COLORS', () => {
    const theme = resolveTheme({}, { ...TTY, isTTY: false });
    expect(theme.enabled).toBe(false);
    expect(theme.colorOf('providers', 'claude')).toBe('magenta');
  });
});
