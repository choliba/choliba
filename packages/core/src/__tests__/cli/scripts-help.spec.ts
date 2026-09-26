import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatHelp } from '../../cli/help';
import {
  fileSummary,
  OTHER_GROUP,
  readPackageScripts,
  resolveScriptCli,
  resolveScriptFile,
  scriptsHelpSpec,
  scriptSummary,
} from '../../cli/scripts-help';
import { makeTmpDir } from '../helpers/tmp';

/**
 * A repo with an opted-in CLI package, a package that did not opt in, an unnamed opted-in package,
 * and script files with and without a top comment.
 */
function fakeRepo(): { readonly path: string; readonly cleanup: () => void } {
  const tmp = makeTmpDir('scripts-help');
  const write = (file: string, content: string): void => {
    mkdirSync(join(tmp.path, file, '..'), { recursive: true });
    writeFileSync(join(tmp.path, file), content);
  };
  write('package.json', '{}');
  write('packages/cli/package.json', JSON.stringify({ name: '@scope/cli', cholCompletion: true }));
  write('packages/cli/src/main.ts', '');
  write('packages/other/package.json', '{}');
  write('packages/other/src/main.ts', '');
  write('packages/unnamed/package.json', JSON.stringify({ cholCompletion: true }));
  write('packages/unnamed/src/main.ts', '');
  write('scripts/tool.ts', '/**\n * Faz a coisa. Detalhes que não aparecem.\n */\nexport {};\n');
  write('scripts/single.ts', '/** Uma frase só */\n');
  write('scripts/bare.ts', 'console.log(1);\n');
  return tmp;
}

const SCRIPTS = {
  cli: 'bun packages/cli/src/main.ts',
  shortcut: 'bun cli --flag',
  'run:shortcut': 'bun run shortcut sub',
  other: 'bun packages/other/src/main.ts',
  tool: 'bun run scripts/tool.ts',
  lint: 'eslint .',
  empty: 'bun run',
  loop: 'bun run loop',
  missing: 'bun packages/nope/main.ts',
  unnamed: 'bun packages/unnamed/src/main.ts',
};

describe('readPackageScripts', () => {
  it('reads string scripts and treats anything else as empty', () => {
    expect(readPackageScripts({ scripts: { a: 'x', b: 1 } })).toEqual({ scripts: { a: 'x' } });
    expect(readPackageScripts(null)).toEqual({ scripts: {} });
    expect(readPackageScripts({ scripts: [] })).toEqual({ scripts: {} });
  });
});

describe('resolveScriptFile / resolveScriptCli', () => {
  it('follows the script chain to a repo file, keeping the fixed arguments', () => {
    const repo = fakeRepo();
    try {
      expect(resolveScriptFile(SCRIPTS, 'tool', repo.path)).toEqual({ file: 'scripts/tool.ts', args: [] });
      expect(resolveScriptCli(SCRIPTS, 'run:shortcut', repo.path)).toEqual({
        file: 'packages/cli/src/main.ts',
        args: ['--flag', 'sub'],
        packageName: 'cli',
      });
      expect(resolveScriptCli(SCRIPTS, 'unnamed', repo.path)?.packageName).toBe('unnamed');
    } finally {
      repo.cleanup();
    }
  });

  it('finds no file for tools, empty or looping chains and missing files', () => {
    const repo = fakeRepo();
    try {
      for (const name of ['lint', 'empty', 'loop', 'missing', 'unknown']) {
        expect(resolveScriptFile(SCRIPTS, name, repo.path)).toBeUndefined();
      }
    } finally {
      repo.cleanup();
    }
  });

  it('only treats files of opted-in packages as CLIs', () => {
    const repo = fakeRepo();
    try {
      for (const name of ['other', 'tool', 'lint']) {
        expect(resolveScriptCli(SCRIPTS, name, repo.path)).toBeUndefined();
      }
    } finally {
      repo.cleanup();
    }
  });

  it('stops at the repo root when no package.json owns the file', () => {
    const tmp = makeTmpDir('scripts-help-bare');
    try {
      writeFileSync(join(tmp.path, 'tool.ts'), '');
      expect(resolveScriptCli({ tool: 'bun tool.ts' }, 'tool', tmp.path)).toBeUndefined();
    } finally {
      tmp.cleanup();
    }
  });
});

describe('fileSummary / scriptSummary', () => {
  it("reads the first sentence of the file's top comment", () => {
    const repo = fakeRepo();
    try {
      expect(fileSummary(repo.path, 'scripts/tool.ts')).toBe('Faz a coisa.');
      expect(fileSummary(repo.path, 'scripts/single.ts')).toBe('Uma frase só');
      expect(fileSummary(repo.path, 'scripts/bare.ts')).toBeUndefined();
    } finally {
      repo.cleanup();
    }
  });

  it('falls back to the command itself', () => {
    const repo = fakeRepo();
    try {
      const scripts = { ...SCRIPTS, bare: 'bun run scripts/bare.ts' };
      expect(scriptSummary(scripts, 'tool', repo.path)).toBe('Faz a coisa.');
      expect(scriptSummary(scripts, 'bare', repo.path)).toBe('bun run scripts/bare.ts');
      expect(scriptSummary(scripts, 'lint', repo.path)).toBe('eslint .');
      expect(scriptSummary(scripts, 'unknown', repo.path)).toBe('');
    } finally {
      repo.cleanup();
    }
  });
});

describe('scriptsHelpSpec', () => {
  it('groups CLIs by package, shared prefixes together and the rest under Outros, hiding lifecycle scripts', () => {
    const repo = fakeRepo();
    try {
      const pkg = readPackageScripts({
        scripts: {
          lint: 'eslint .',
          test: 'jest',
          'test:cov': 'jest --coverage',
          prepare: 'git config x',
          cli: SCRIPTS.cli,
          shortcut: SCRIPTS.shortcut,
          'x:tool': SCRIPTS.tool,
        },
      });
      const describeCli = jest.fn((cli: { readonly args: readonly string[] }) =>
        cli.args.length === 0 ? 'Um CLI' : '',
      );

      expect(formatHelp(scriptsHelpSpec(pkg, repo.path, describeCli))).toBe(
        [
          'Usage:  bun run SCRIPT [ARGS]',
          '',
          'Scripts do monorepo choliba.',
          '',
          'test:',
          '  test       jest',
          '  test:cov   jest --coverage',
          '',
          'cli:',
          '  cli        Um CLI (--help)',
          '  shortcut   (--help)',
          '',
          `${OTHER_GROUP}:`,
          '  lint       eslint .',
          '  x:tool     Faz a coisa.',
          '',
          "Run 'bun chol:help SCRIPT' for more information on a script.",
        ].join('\n'),
      );
    } finally {
      repo.cleanup();
    }
  });
});
