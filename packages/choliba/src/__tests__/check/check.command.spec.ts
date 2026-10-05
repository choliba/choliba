import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fakePlatform, runCommand } from '@choliba/core/testing';

import { CheckModule } from '../../check/check.module';
import { withFolder, withWorkspace } from '../helpers/runtime';

async function check(args: readonly string[], cwd: string): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['check', ...args], cwd });
  const code = await runCommand([CheckModule], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba check', () => {
  it('reports the agents and projects, exit 0 when all is fine', () =>
    withWorkspace(
      async (root) => {
        writeFileSync(join(root, '.env'), `CHOL_GLOBAL_DIR=${root}\n`);
        const { code, out } = await check([], root);
        expect(out).toContain('Agentes (');
        expect(out).toContain('Projetos (');
        expect(code).toBe(0);
      },
      { '.choliba/agents/.gitkeep': '', 'projects/.gitkeep': '' },
    ));

  it('exits 1 when something is wrong', () =>
    withWorkspace(async (root) => {
      const { code, out } = await check([], root);
      expect(out).toContain('a pasta não existe');
      expect(code).toBe(1);
    }));

  it('says there is no workspace, with exit code 1, outside one', () =>
    withFolder(async (dir) => {
      const { code, err } = await check([], dir);
      expect(code).toBe(1);
      expect(err).toContain('Nenhuma pasta de trabalho do choliba');
    }));

  it('prints its help', () =>
    withFolder(async (dir) => {
      expect((await check(['--help'], dir)).out).toContain('Usage:  choliba check');
    }));
});
