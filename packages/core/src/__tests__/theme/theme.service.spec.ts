import { Test } from '@nestjs/testing';

import { ConfigModule, PlatformModule, ThemeModule, ThemeService } from '../../nest';
import { BufferWritable, fakePlatform, type FakePlatform } from '../../testing';
import { makeWorkspace } from '../helpers/workspace';

async function themeFor(platform: FakePlatform): Promise<ThemeService> {
  const moduleRef = await Test.createTestingModule({
    imports: [PlatformModule.forRoot(platform), ConfigModule, ThemeModule],
  }).compile();
  return moduleRef.get(ThemeService);
}

describe('ThemeService', () => {
  it('paints with the colors of the workspace .env when stdout is a terminal', async () => {
    const workspace = makeWorkspace({ '.env': 'CHOL_COLORS=agents.implementer=blue\n' });
    try {
      const theme = await themeFor(fakePlatform({ cwd: workspace.path, stdout: new BufferWritable(true) }));

      expect(theme.enabled()).toBe(true);
      expect(theme.theme().enabled).toBe(true);
      expect(theme.colorOf('agents', 'implementer')).toBe('blue');
      expect(theme.paint('agents', 'implementer', 'x')).toBe('\u001b[34mx\u001b[0m');
      expect(theme.paint('agents', 'novo', 'x', 'gray')).toBe('\u001b[90mx\u001b[0m');
    } finally {
      workspace.cleanup();
    }
  });

  it('writes plain text with --no-color, NO_COLOR or a pipe', async () => {
    const flag = await themeFor(fakePlatform({ stdout: new BufferWritable(true), noColorFlag: true }));
    const env = await themeFor(fakePlatform({ stdout: new BufferWritable(true), env: { NO_COLOR: '1' } }));
    const pipe = await themeFor(fakePlatform());

    for (const theme of [flag, env, pipe]) {
      expect(theme.enabled()).toBe(false);
      expect(theme.paint('states', 'error', 'x')).toBe('x');
    }
  });

  it('takes CHOL_COLORS from the process environment outside a workspace', async () => {
    const theme = await themeFor(
      fakePlatform({ stdout: new BufferWritable(true), env: { CHOL_COLORS: 'states.error=yellow' } }),
    );

    expect(theme.colorOf('states', 'error')).toBe('yellow');
  });

  it('colors a pipe with FORCE_COLOR', async () => {
    const theme = await themeFor(fakePlatform({ env: { FORCE_COLOR: '1' } }));

    expect(theme.paint('states', 'success', 'ok')).toBe('\u001b[32mok\u001b[0m');
  });
});
