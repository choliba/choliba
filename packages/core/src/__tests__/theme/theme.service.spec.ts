import { parseColors, ThemeService } from '../../theme';
import { BufferWritable, fakePlatform, type FakePlatform } from '../../testing';

function themeFor(platform: FakePlatform, colors?: string): ThemeService {
  return new ThemeService(platform.env, platform.stdout, platform.noColorFlag, parseColors(colors));
}

describe('ThemeService', () => {
  it('paints with the choices supplied by the app when stdout is a terminal', () => {
    const theme = themeFor(fakePlatform({ stdout: new BufferWritable(true) }), 'agents.implementer=blue');

    expect(theme.enabled()).toBe(true);
    expect(theme.theme().enabled).toBe(true);
    expect(theme.colorOf('agents', 'implementer')).toBe('blue');
    expect(theme.paint('agents', 'implementer', 'x')).toBe('\u001b[34mx\u001b[0m');
    expect(theme.paint('agents', 'novo', 'x', 'gray')).toBe('\u001b[90mx\u001b[0m');
  });

  it('writes plain text with --no-color, NO_COLOR or a pipe', () => {
    const flag = themeFor(fakePlatform({ stdout: new BufferWritable(true), noColorFlag: true }));
    const env = themeFor(fakePlatform({ stdout: new BufferWritable(true), env: { NO_COLOR: '1' } }));
    const pipe = themeFor(fakePlatform());

    for (const theme of [flag, env, pipe]) {
      expect(theme.enabled()).toBe(false);
      expect(theme.paint('states', 'error', 'x')).toBe('x');
    }
  });

  it('takes color choices independently from the process environment', () => {
    const theme = themeFor(fakePlatform({ stdout: new BufferWritable(true) }), 'states.error=yellow');

    expect(theme.colorOf('states', 'error')).toBe('yellow');
  });

  it('colors a pipe with FORCE_COLOR', () => {
    const theme = themeFor(fakePlatform({ env: { FORCE_COLOR: '1' } }));

    expect(theme.paint('states', 'success', 'ok')).toBe('\u001b[32mok\u001b[0m');
  });
});
