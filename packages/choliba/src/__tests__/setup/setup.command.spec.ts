import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { fakePlatform, runCommand } from '@choliba/core/testing';

import { RuntimeModule } from '../../runtime/runtime.module';
import { SetupModule } from '../../setup/setup.module';
import { fakeRuntime, withFolder, withWorkspace, type FakeRuntime } from '../helpers/runtime';

async function setup(
  args: readonly string[],
  cwd: string,
  runtime: FakeRuntime,
  env: Readonly<Record<string, string>> = {},
): Promise<{ code: number; out: string }> {
  const platform = fakePlatform({ argv: ['setup', ...args], cwd, env });
  const code = await runCommand([RuntimeModule.forRoot(runtime), SetupModule], platform);
  return { code, out: platform.stdout.text() };
}

describe('choliba setup', () => {
  it('builds the workspace, turns completion on in the home folder, and says what comes next', () =>
    withFolder((home) =>
      withWorkspace(async (root) => {
        const { code, out } = await setup([], root, fakeRuntime({ home }));

        expect(code).toBe(0);
        expect(out).toContain(`Pasta de trabalho: ${root}`);
        expect(out).toContain('Próximos passos:');
        expect(readFileSync(join(home, '.bashrc'), 'utf8')).toContain('Autocomplete do choliba');
      }),
    ));

  it('as the postinstall, writes to the terminal (Bun hides its output) and finishes in the background', () =>
    withFolder(async (home) => {
      const workspace = join(home, 'w');
      const installed = join(workspace, 'node_modules', 'choliba');
      mkdirSync(installed, { recursive: true });
      writeFileSync(join(workspace, 'package.json'), JSON.stringify({ name: 'w' }));
      const runtime = fakeRuntime({ home, tty: true });

      const { out } = await setup([], installed, runtime, { npm_lifecycle_event: 'postinstall' });

      expect(out).toBe('');
      expect(runtime.terminal.join('')).toContain('choliba instalado.');
      expect(runtime.detached).toEqual([
        { command: ['/usr/bin/bun', '/bin/choliba.js', 'setup', '--deferred'], cwd: workspace },
      ]);
    }));

  it('with --deferred, waits for package.json to list choliba and then updates it', () =>
    withWorkspace(async (root) => {
      await setup(['--deferred'], root, fakeRuntime());

      expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).toMatchObject({
        trustedDependencies: ['choliba'],
      });
    }));

  it('prints its help', () =>
    withFolder(async (dir) => {
      expect((await setup(['--help'], dir, fakeRuntime())).out).toContain('Usage:  choliba setup');
    }));
});
