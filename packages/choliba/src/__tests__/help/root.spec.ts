import { join } from 'node:path';

import { FILES_MARKER } from '@choliba/core';
import { fakePlatform, type FakePlatform } from '@choliba/core/testing';

import { createCholibaShell } from '../../app-shell';
import { fakeRuntime, withFolder, withWorkspace } from '../helpers/runtime';

const FIXTURES = join(__dirname, '..', '..', '..', '..', 'agents', 'src', '__tests__', 'fixtures');
const ENV = ['agents', 'skills', 'mcps']
  .map((dir) => `CHOL_${dir.toUpperCase()}_DIR=${join(FIXTURES, dir)}\n`)
  .join('');

async function choliba(
  argv: readonly string[],
  cwd: string,
  overrides: Partial<FakePlatform> = {},
): Promise<{ code: number; out: string; err: string }> {
  const platform = fakePlatform({ argv, cwd, ...overrides });
  const code = await createCholibaShell(platform, fakeRuntime()).run();
  return { code, out: platform.stdout.text(), err: platform.stderr.text() };
}

describe('choliba', () => {
  it.each([[[]], [['help']], [['--help']], [['-h']]])('prints its help for %j', (argv) =>
    withFolder(async (dir) => {
      const { code, out } = await choliba(argv, dir);
      expect(code).toBe(0);
      expect(out).toContain('Usage:  choliba COMMAND [ARGS]');
      expect(out).toContain('check');
      expect(out).toContain('--no-color');
    }),
  );

  it('prints its version for --version', () =>
    withFolder(async (dir) => {
      const { code, out } = await choliba(['--version'], dir);
      expect(code).toBe(0);
      expect(out).toMatch(/^choliba 0\.0\.1-dev\S*\n$/);
    }));

  it('runs an agent given as the first word, as `choliba agents <agent>` would', () =>
    withWorkspace(
      async (root) => {
        const which = (bin: string): string | null => (bin === 'claude' ? '/usr/bin/claude' : null);
        const dry = await choliba(['echo', '--dry-run', 'repita'], root, { which });
        expect(dry.code).toBe(0);
        expect(dry.out).toContain('Sem --dry-run, faria nesta ordem:');

        const unknown = await choliba(['nope', 'x'], root);
        expect(unknown.code).toBe(1);
        expect(unknown.err).toContain('Unknown command "nope". Run "choliba agents list"');

        const playwright = await choliba(['playwright-cli', 'open'], root);
        expect(playwright.code).toBe(1);
        expect(playwright.err).toContain('Unknown command "playwright-cli"');
      },
      { '.env': ENV },
    ));

  it('says there is no workspace, with exit code 1, for an agent outside one', () =>
    withFolder(async (dir) => {
      const { code, err } = await choliba(['echo'], dir);
      expect(code).toBe(1);
      expect(err).toContain('Nenhuma pasta de trabalho do choliba');
    }));
});

describe('choliba __complete', () => {
  it('completes the whole line: the commands and agents first, then what each takes', () =>
    withWorkspace(
      async (root) => {
        const complete = async (...words: string[]): Promise<string> =>
          (await choliba(['__complete', ...words], root)).out;

        expect(await complete('')).toContain('agents\nadd\nprojects\n');
        expect(await complete('ec')).toBe('echo\n');
        expect(await complete('agents', 'ec')).toBe('echo\n');
        expect(await complete('echo', '--provider', '')).toBe('auto\nclaude\ncursor\n');
        expect(await complete('tests', '--ex')).toBe('--expect\n');
        expect(await complete('projects', 'li')).toBe('list\n');
      },
      { '.env': ENV },
    ));

  it('completes only the commands outside a workspace, with no agent', () =>
    withFolder(async (dir) => {
      expect((await choliba(['__complete', 'p'], dir)).out).toBe('projects\n');
      expect((await choliba(['__complete', 'tests', 'x'], dir)).out).toBe('');
    }));
});

describe('choliba __complete, per command', () => {
  it('completes what each command takes after its name, outside a workspace too', () =>
    withFolder(async (dir) => {
      const complete = async (...words: string[]): Promise<string> =>
        (await choliba(['__complete', ...words], dir)).out;

      for (const name of ['lint', 'format']) {
        expect(await complete(name, '..')).toBe(`${FILES_MARKER}\n`);
      }
      expect(await complete('format', '--')).toBe('--write\n');
      expect(await complete('tests', 'demo:')).toBe('');
    }));
});

describe('choliba __describe', () => {
  it('says in one line what the words select', () =>
    withFolder(async (dir) => {
      expect((await choliba(['__describe', 'tests'], dir)).out).toBe(
        'Roda os testes E2E dos projetos com o Playwright\n',
      );
      expect((await choliba(['__describe'], dir)).out).toMatch(/^Testes E2E multiprojeto/);
    }));
});
