import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fakePlatform, runCommand } from '@choliba/core/testing';

import { RuntimeModule } from '../../runtime/runtime.module';
import { ToolingModule } from '../../tooling/tooling.module';
import { fakeRuntime, withFolder, withWorkspace, type FakeRuntime } from '../helpers/runtime';

async function tool(
  args: readonly string[],
  cwd: string,
  runtime: FakeRuntime,
  which: (bin: string) => string | null = () => '/usr/bin/node',
): Promise<{ code: number; err: string }> {
  const platform = fakePlatform({ argv: args, cwd, which });
  const code = await runCommand([RuntimeModule.forRoot(runtime), ToolingModule], platform);
  return { code, err: platform.stderr.text() };
}

describe('choliba lint', () => {
  it('runs the shipped ESLint on the workspace, with the shipped config when the workspace has none, and passes its exit code on', () =>
    withWorkspace(async (root) => {
      const runtime = fakeRuntime({ status: 2 });

      expect((await tool(['lint'], root, runtime)).code).toBe(2);
      const [run] = runtime.runs;
      expect(run?.command).toBe('/usr/bin/node');
      expect(run?.args[0]).toMatch(/eslint/);
      expect(run?.args.slice(-1)).toEqual(['.']);
      expect(run?.cwd).toBe(root);
    }));

  it("uses the workspace's own config, and the paths given", () =>
    withWorkspace(
      async (root) => {
        const runtime = fakeRuntime();
        await tool(['lint', 'src', '--fix'], root, runtime, () => null);

        expect(runtime.runs[0]?.command).toBe('/usr/bin/bun');
        expect(runtime.runs[0]?.args.slice(1)).toEqual(['src', '--fix']);
      },
      { 'eslint.config.mjs': 'export default [];' },
    ));
});

describe('choliba lint, installed', () => {
  it('passes the config shipped next to the bundle when the workspace has none', () =>
    withWorkspace(async (root) => {
      const bin = mkdtempSync(join(tmpdir(), 'bin-'));
      try {
        writeFileSync(join(bin, 'eslint.js'), 'export default [];');
        const runtime = fakeRuntime({ entryDir: bin });
        await tool(['lint'], root, runtime);

        expect(runtime.runs[0]?.args.slice(1)).toEqual(['--config', join(bin, 'eslint.js'), '.']);
      } finally {
        rmSync(bin, { recursive: true, force: true });
      }
    }));
});

describe('choliba format', () => {
  it('checks the workspace with Prettier, or fixes it with --write', () =>
    withWorkspace(async (root) => {
      const runtime = fakeRuntime();
      await tool(['format'], root, runtime);
      await tool(['format', '--write', 'a.ts'], root, runtime);

      expect(runtime.runs.map((run) => run.args.slice(1))).toEqual([
        ['--check', '.'],
        ['--write', 'a.ts'],
      ]);
      expect(runtime.runs[0]?.args[0]).toMatch(/prettier/);
    }));
});

describe('the tools, when they cannot run', () => {
  it('say why, with exit code 1: outside a workspace, or a dependency without the executable', async () => {
    await withFolder(async (dir) => {
      const outside = await tool(['format'], dir, fakeRuntime());
      expect(outside).toEqual({
        code: 1,
        err: expect.stringContaining('Nenhuma pasta de trabalho do choliba') as string,
      });
    });

    const noBin = mkdtempSync(join(tmpdir(), 'no-bin-'));
    try {
      writeFileSync(join(noBin, 'package.json'), JSON.stringify({ name: 'prettier' }));
      writeFileSync(join(noBin, 'list.json'), '[]');
      await withWorkspace(async (root) => {
        const expected = { code: 1, err: 'prettier não declara o executável prettier.\n' };
        expect(await tool(['format'], root, fakeRuntime({ resolve: () => join(noBin, 'package.json') }))).toEqual(
          expected,
        );
        expect(await tool(['format'], root, fakeRuntime({ resolve: () => join(noBin, 'list.json') }))).toEqual(
          expected,
        );
      });
    } finally {
      rmSync(noBin, { recursive: true, force: true });
    }
  });
});
