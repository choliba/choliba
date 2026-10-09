import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Test } from '@nestjs/testing';

import { complete, describe as describeWords, formatSuggestions } from '@choliba/core';
import { PlatformModule } from '@choliba/core/nest';
import { fakePlatform, runCommand, type FakePlatform } from '@choliba/core/testing';

import { RUNNER_ROOT, TESTS_HOOKS, TestsModule, TestsService, type TestsHooks } from '../../nest';

interface Workspace {
  readonly root: string;
  readonly projectsDir: string;
}

/** A workspace whose .env points CHOL_PROJECTS_DIR at a folder with the `demo` project and its tickets. */
async function withWorkspace(fn: (workspace: Workspace) => Promise<void>, env = true): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tests-cmd-'));
  const projectsDir = path.join(root, 'projects');
  const demo = path.join(projectsDir, 'demo');
  fs.mkdirSync(path.join(demo, 'tickets'), { recursive: true });
  fs.mkdirSync(path.join(demo, 'tests'));
  fs.writeFileSync(
    path.join(demo, 'config.json'),
    JSON.stringify({ name: 'Demo', envs: [{ nome: 'development', baseURL: 'http://localhost/', appDir: '/app' }] }),
  );
  fs.writeFileSync(path.join(demo, '.env.json'), JSON.stringify({ development: {} }));
  for (const ticket of ['T-01', 'T-02']) {
    fs.writeFileSync(path.join(demo, 'tickets', `${ticket}.json`), JSON.stringify({ criterios: [] }));
  }
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { choliba: '*' } }));
  if (env) fs.writeFileSync(path.join(root, '.env'), `CHOL_GLOBAL_DIR=/g\nCHOL_PROJECTS_DIR=${projectsDir}\n`);
  try {
    await fn({ root, projectsDir });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function tests(
  args: readonly string[],
  cwd: string,
  hooks: TestsHooks,
): Promise<{ code: number; platform: FakePlatform }> {
  const platform = fakePlatform({ argv: ['tests', ...args], cwd });
  const code = await runCommand([TestsModule], platform, [
    { provide: TESTS_HOOKS, useValue: { stdinIsTTY: false, ...hooks } },
    { provide: RUNNER_ROOT, useValue: cwd },
  ]);
  return { code, platform };
}

describe('choliba tests', () => {
  it.each([['--help'], ['-h'], ['demo:T-01', '--help']])(
    'shows its own help for %s instead of Playwright’s',
    (...args) =>
      withWorkspace(async ({ root }) => {
        const spawnPlaywright = jest.fn(() => 0);
        const { code, platform } = await tests(args, root, { spawnPlaywright });

        expect(code).toBe(0);
        expect(spawnPlaywright).not.toHaveBeenCalled();
        const help = platform.stdout.text();
        expect(help).toContain('choliba tests [PROJECT');
        expect(help).toContain('--expect');
        expect(help).toContain('playwright test --help');
      }),
  );

  it("passes Playwright's exit code on, with the arguments as typed", () =>
    withWorkspace(async ({ root }) => {
      const calls: string[][] = [];
      const { code } = await tests(['--list', '--', 'x'], root, {
        spawnPlaywright: (args) => {
          calls.push(args);
          return 3;
        },
      });

      expect(code).toBe(3);
      expect(calls).toEqual([['test', '--list', '--', 'x']]);
    }));

  it('says what is wrong with the command line on stderr, with exit code 1', () =>
    withWorkspace(async ({ root }) => {
      const spawnPlaywright = jest.fn(() => 0);
      const { code, platform } = await tests(['demo', 'demo-T-01'], root, { spawnPlaywright });

      expect(code).toBe(1);
      expect(platform.stderr.text()).toBe(
        'erro: "demo demo-T-01" parece projeto e ticket separados por espaço — use ":" (ex.: demo:demo-T-01).\n',
      );
      expect(spawnPlaywright).not.toHaveBeenCalled();
    }));
});

describe('choliba tests — color', () => {
  it('keeps Playwright colored when choliba is, and turns its color off when choliba is not', () =>
    withWorkspace(async ({ root }) => {
      const envs: NodeJS.ProcessEnv[] = [];
      const spawnPlaywright = (_args: string[], env: NodeJS.ProcessEnv): number => {
        envs.push(env);
        return 0;
      };
      const colored = fakePlatform({ argv: ['tests', '--list'], cwd: root, env: { FORCE_COLOR: '1' } });
      const plain = fakePlatform({ argv: ['tests', '--list'], cwd: root, env: { NO_COLOR: '1' } });
      for (const platform of [colored, plain]) {
        await runCommand([TestsModule], platform, [
          { provide: TESTS_HOOKS, useValue: { stdinIsTTY: false, spawnPlaywright } },
          { provide: RUNNER_ROOT, useValue: root },
        ]);
      }

      // FORCE_COLOR=0 and no NO_COLOR: Playwright's workers get FORCE_COLOR=1, and Node warns when both are set.
      expect(envs.map((env) => [env['FORCE_COLOR'], env['NO_COLOR']])).toEqual([
        ['1', undefined],
        ['0', undefined],
      ]);
    }));
});

describe('TestsModule', () => {
  it("finds the runner's Playwright config on its own", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot(fakePlatform()), TestsModule],
    }).compile();

    expect(fs.existsSync(path.join(moduleRef.get<string>(RUNNER_ROOT), 'playwright.config.ts'))).toBe(true);
  });
});

describe('TestsService.helpSpec — completion and description', () => {
  async function specIn(cwd: string): Promise<ReturnType<TestsService['helpSpec']>> {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot(fakePlatform({ cwd })), TestsModule],
    })
      .overrideProvider(RUNNER_ROOT)
      .useValue(cwd)
      .compile();
    return moduleRef.get(TestsService).helpSpec();
  }

  it('completes its flags, the projects, their tickets and the values of --expect', () =>
    withWorkspace(async ({ root }) => {
      const spec = await specIn(root);
      const completions = (...words: string[]): string => formatSuggestions(complete(spec, words));

      expect(completions('--')).toBe('--expect\n--failures\n--help');
      expect(completions('')).toBe('help\nversion\ndemo');
      expect(completions('demo', '--expect', '')).toBe('red\ngreen');
      expect(completions('demo', 'x')).toBe('');
      expect(completions('demo', '--failures', '')).toBe(':files');
      expect(completions('demo:')).toBe('demo:T-01\ndemo:T-02');
      expect(completions('demo:T-02')).toBe('demo:T-02');
      expect(completions('nope:')).toBe('');
    }));

  it('completes no project when the workspace locations cannot be read', () =>
    withWorkspace(async ({ root }) => {
      expect(formatSuggestions(complete(await specIn(root), ['']))).toBe('help\nversion');
    }, false));

  it('describes itself, examples after the first line', () =>
    withWorkspace(async ({ root }) => {
      expect(describeWords(await specIn(root), []).split('\n')[0]).toBe(
        'Roda os testes E2E dos projetos com o Playwright. Sem PROJECT, roda todos os projetos.',
      );
    }));
});
