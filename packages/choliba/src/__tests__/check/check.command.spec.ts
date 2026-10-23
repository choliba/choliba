import fs, { writeFileSync } from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';

import { fakePlatform } from '@choliba/kernel/testing';

import { createCholibaShell } from '../../app-shell';
import { fakeRuntime, withFolder, withWorkspace } from '../helpers/runtime';

async function check(args: readonly string[], cwd: string): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['check', ...args], cwd });
  const code = await createCholibaShell(platform, fakeRuntime()).run();
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

/** A workspace whose projects folder has `demo`, ready when `ready`, with `CHANGE_ME` left otherwise. */
function withProject(ready: boolean, run: (root: string) => Promise<void>): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'choliba-check-cmd-'));
  const projectsDir = path.join(root, 'projects');
  const demo = path.join(projectsDir, 'demo');
  fs.mkdirSync(demo, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  fs.writeFileSync(path.join(root, '.env'), `CHOL_GLOBAL_DIR=/global\nCHOL_PROJECTS_DIR=${projectsDir}\n`);
  fs.writeFileSync(
    path.join(demo, 'config.json'),
    JSON.stringify({
      name: 'Demo',
      envs: [{ nome: 'development', baseURL: 'http://localhost:5173/', appDir: '/app' }],
    }),
  );
  fs.writeFileSync(
    path.join(demo, '.env.json'),
    JSON.stringify({ development: { TEST_USERNAME: ready ? 'ana' : 'CHANGE_ME' } }),
  );
  return run(root).finally(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });
}

/** `choliba check <args…>` through the whole app, which has the projects' services. */
async function checkProject(args: readonly string[], cwd: string): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv: ['check', ...args], cwd });
  const code = await createCholibaShell(platform, fakeRuntime()).run();
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba check PROJETO', () => {
  it('says the project is ready, with its environment', () =>
    withProject(true, async (root) => {
      expect(await checkProject(['demo'], root)).toEqual({
        code: 0,
        out: 'Projeto "demo" (Demo) pronto: ambiente development, http://localhost:5173/\n',
        err: '',
      });
    }));

  it('names what is still CHANGE_ME, and a project that does not exist, with exit code 1', () =>
    withProject(false, async (root) => {
      const pending = await checkProject(['demo'], root);
      expect(pending.code).toBe(1);
      expect(pending.err).toContain('troque CHANGE_ME em:');

      const missing = await checkProject(['nope'], root);
      expect(missing.code).toBe(1);
      expect(missing.err).toContain('Projeto "nope" não encontrado');
    }));

  it('refuses more than one project, and prints its help', () =>
    withProject(true, async (root) => {
      expect(await checkProject(['demo', 'outro'], root)).toEqual({
        code: 1,
        out: '',
        err: "argumento a mais: outro.\nRun 'choliba check --help' for usage.\n",
      });
      const help = await checkProject(['--help'], root);
      expect(help.code).toBe(0);
      expect(help.out).toContain('Usage:  choliba check [PROJETO]');
    }));

  it('completes the projects on disk', () =>
    withProject(true, async (root) => {
      const platform = fakePlatform({ argv: ['__complete', 'check', ''], cwd: root });
      await createCholibaShell(platform, fakeRuntime()).run();
      expect(platform.stdout.text()).toBe('demo\n');
    }));
});
