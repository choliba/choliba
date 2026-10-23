import { BufferWritable, fakePlatform } from '@choliba/kernel/testing';

import { createCholibaShell } from '../../app-shell';
import { fakeRuntime } from '../helpers/runtime';
import { makeWorkspace } from '../helpers/workspace';

async function listConfig(
  args: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>> = {},
): Promise<{ code: number; out: string; err: string }> {
  const stdout = new BufferWritable();
  const stderr = new BufferWritable();
  const code = await createCholibaShell(
    fakePlatform({ argv: ['list', 'config', ...args], cwd, env, stdout, stderr }),
    fakeRuntime(),
  ).run();
  return { code, out: stdout.text(), err: stderr.text() };
}

describe('choliba list config', () => {
  it('lists each key with the value in effect and where it comes from, credentials masked', async () => {
    const workspace = makeWorkspace({ '.env': 'CHOL_SANDBOX=docker\nCURSOR_API_KEY=segredo\n' });
    try {
      const { code, out, err } = await listConfig([], workspace.path, { CHOL_NETWORK: 'host' });

      expect(code).toBe(0);
      expect(err).toBe('');
      expect(out).toMatch(/^CHOL_SANDBOX +docker \(\.env\)$/m);
      expect(out).toMatch(/^CHOL_NETWORK +host \(ambiente\)$/m);
      expect(out).toMatch(/^CHOL_AGENTS_PROVIDER +auto \(padrão\)$/m);
      expect(out).toMatch(/^CURSOR_API_KEY +definida \(\.env\)$/m);
      expect(out).toMatch(/^CHOL_COLORS +não definida$/m);
      expect(out).not.toContain('segredo');
    } finally {
      workspace.cleanup();
    }
  });

  it('gives the same in JSON, credentials masked too', async () => {
    const workspace = makeWorkspace({ '.env': 'CLAUDE_CODE_OAUTH_TOKEN=segredo\n' });
    try {
      const { out } = await listConfig(['--json'], workspace.path);
      const parsed = JSON.parse(out) as Record<string, { valor: string | null; origem: string }>;

      expect(parsed['CLAUDE_CODE_OAUTH_TOKEN']).toEqual({ valor: 'definida', origem: '.env' });
      expect(parsed['CURSOR_API_KEY']).toEqual({ valor: null, origem: 'nenhum' });
      expect(parsed['CHOL_SANDBOX']).toEqual({ valor: 'local', origem: 'padrão' });
      expect(out).not.toContain('segredo');
    } finally {
      workspace.cleanup();
    }
  });

  it('says outside a workspace that there is no .env, and lists the environment and the defaults', async () => {
    const { code, out, err } = await listConfig([], '/', { CHOL_SANDBOX: 'docker' });

    expect(code).toBe(0);
    expect(err).toBe('Fora de uma pasta de trabalho: sem .env, só o ambiente e os padrões.\n');
    expect(out).toMatch(/^CHOL_SANDBOX +docker \(ambiente\)$/m);
  });

  it('prints its help', async () => {
    const { out } = await listConfig(['--help'], '/');

    expect(out).toContain('choliba list config [OPTIONS]');
    expect(out).toContain('--json');
  });
});
