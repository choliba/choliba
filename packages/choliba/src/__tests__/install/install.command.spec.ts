import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { fakePlatform, runCommand } from '@choliba/core/testing';

import { InstallModule } from '../../install/install.module';
import { RuntimeModule } from '../../runtime/runtime.module';
import { fakeRuntime, withFolder, withWorkspace } from '../helpers/runtime';

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'agents', 'src', '__tests__', 'fixtures');

async function install(args: readonly string[], cwd: string): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['install', ...args], cwd });
  const code = await runCommand([RuntimeModule.forRoot(fakeRuntime()), InstallModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba install', () => {
  it('installs an agent with the skills it lists into the workspace, or only says what it would with --dry-run', () =>
    withWorkspace(async (root) => {
      const source = join(FIXTURES, 'agents', 'echo');

      const planned = await install([source, '--dry-run'], root);
      expect(planned.code).toBe(0);
      expect(planned.out).toContain('echo');
      expect(existsSync(join(root, '.choliba', 'agents', 'echo'))).toBe(false);

      const done = await install([source], root);
      expect(done.code).toBe(0);
      expect(existsSync(join(root, '.choliba', 'agents', 'echo', 'agent.yaml'))).toBe(true);
    }));

  it('says what is wrong with exit code 1: a source that does not exist, or no workspace', async () => {
    await withWorkspace(async (root) => {
      const missing = await install([join(root, 'nada')], root);
      expect(missing.code).toBe(1);
      expect(missing.err).not.toBe('');
    });
    await withFolder(async (dir) => {
      expect((await install(['x'], dir)).err).toContain('Nenhuma pasta de trabalho do choliba');
    });
  });

  it('prints its help', () =>
    withWorkspace(async (root) => {
      expect((await install(['--help'], root)).out).toContain('Usage:  choliba install <origem> [OPTIONS]');
    }));
});
