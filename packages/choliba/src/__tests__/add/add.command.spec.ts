import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { coreShell, FILES_MARKER } from '@choliba/core';
import { fakePlatform, runShell } from '@choliba/core/testing';

import { cholibaShell } from '../../app-shell';
import { fakeRuntime, withFolder, withWorkspace, type FakeRuntime } from '../helpers/runtime';

/** An agent with no skills or MCPs, as the source to install. */
const AGENTS = join(__dirname, '..', '..', '..', '..', 'agents', 'src', '__tests__', 'fixtures', 'agents');

async function add(
  args: readonly string[],
  cwd: string,
  runtime: FakeRuntime = fakeRuntime(),
  argv: readonly string[] = ['add', ...args],
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv, cwd });
  const code = await runShell([coreShell, cholibaShell(runtime)], platform);
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba add', () => {
  it('prints its help', () =>
    withFolder(async (dir) => {
      const { code, out } = await add(['--help'], dir);
      expect(code).toBe(0);
      expect(out).toContain('Usage:  choliba add <origem> [OPTIONS]');
      expect(out).toContain('--path');
      expect(out).toContain('--dry-run');
    }));

  it('installs an agent from a folder, and --dry-run writes nothing', () =>
    withWorkspace(async (root) => {
      const installed = join(root, '.choliba', 'agents', 'reviewer', 'agent.yaml');

      const preview = await add([join(AGENTS, 'reviewer'), '--dry-run'], root);
      expect(preview.code).toBe(0);
      expect(preview.out).toContain('Instalaria (--dry-run, nada foi gravado):');
      expect(preview.out).toContain('agente reviewer');
      expect(existsSync(installed)).toBe(false);

      const ran = await add(['--path', 'reviewer', AGENTS], root);
      expect(ran.code).toBe(0);
      expect(ran.out).toContain('Instalado:');
      expect(existsSync(installed)).toBe(true);
    }));

  it('asks bun for an npm package', () =>
    withWorkspace(async (root) => {
      const runtime = fakeRuntime({ captured: { status: 1, stderr: 'não achei' } });
      const { code } = await add(['pacote-x'], root, runtime);
      expect(code).toBe(1);
      expect(runtime.runs.some((run) => run.command === 'bun' && run.args.join(' ') === 'add pacote-x')).toBe(true);
    }));

  it('fails without an origin, with two origins and outside a workspace', async () => {
    await withWorkspace(async (root) => {
      const none = await add([], root);
      expect(none.code).toBe(1);
      expect(none.err).toContain('choliba add <origem>');

      const two = await add([join(AGENTS, 'reviewer'), join(AGENTS, 'echo')], root);
      expect(two.code).toBe(1);
      expect(two.err).toContain('uma origem só');
    });
    await withFolder(async (dir) => {
      const { code, err } = await add([join(AGENTS, 'reviewer')], dir);
      expect(code).toBe(1);
      expect(err).toContain('Nenhuma pasta de trabalho do choliba');
    });
  });

  it('completes the origin and the value of --path with file names', () =>
    withWorkspace(async (root) => {
      expect((await add([], root, fakeRuntime(), ['__complete', 'add', ''])).out).toContain(FILES_MARKER);
      expect((await add([], root, fakeRuntime(), ['__complete', 'add', '--path', ''])).out).toContain(FILES_MARKER);
    }));
});
