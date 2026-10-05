import { fakePlatform, runCommand } from '@choliba/core/testing';

import { CompletionModule } from '../../completion/completion.module';

async function completion(args: readonly string[]): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['completion', ...args] });
  const code = await runCommand([CompletionModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba completion', () => {
  it('prints the bash completion script', async () => {
    const { code, out } = await completion(['bash']);
    expect(code).toBe(0);
    expect(out).toContain('__complete');
  });

  it('says only bash is supported for anything else', async () => {
    expect(await completion(['zsh'])).toEqual({
      code: 1,
      out: '',
      err: 'Só o bash é suportado: choliba completion bash\n',
    });
  });

  it('prints its help', async () => {
    expect((await completion(['--help'])).out).toContain('Usage:  choliba completion bash');
  });
});
