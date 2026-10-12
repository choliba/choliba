import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const repo = join(__dirname, '..', '..');

const SUBPATHS = [
  '.',
  './core',
  './core/testing',
  './agents',
  './projects',
  './runner',
  './runner/env',
  './runner/pages/base-page',
  './eslint',
  './package.json',
];

const CHECKER = `import { createShell } from 'choliba/core';
import { fakePlatform } from 'choliba/core/testing';
import { createCholibaShell } from 'choliba';
import { loadAgent } from 'choliba/agents';
import { loadProjectSettings } from 'choliba/projects';
import { runnerShell } from 'choliba/runner';
import { loadProjectEnv } from 'choliba/runner/env';
import { BasePage } from 'choliba/runner/pages/base-page';
import config from 'choliba/eslint';

const values = [createShell, fakePlatform, createCholibaShell, loadAgent, loadProjectSettings, loadProjectEnv, BasePage];
if (values.some((value) => typeof value !== 'function')) throw new Error('a subpath did not export its function');
if (typeof runnerShell !== 'object' || runnerShell === null) throw new Error('choliba/runner');
if (!Array.isArray(config)) throw new Error('choliba/eslint');

try {
  await import('choliba/agents/src/x');
  throw new Error('undeclared import succeeded');
} catch (error) {
  if (error instanceof Error && error.message === 'undeclared import succeeded') throw error;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  const nodeRefused = code === 'ERR_PACKAGE_PATH_NOT_EXPORTED';
  const bunRefused = typeof Bun !== 'undefined' && code === 'ERR_MODULE_NOT_FOUND';
  if (!nodeRefused && !bunRefused) throw error;
}
`;

const TYPECHECK = `import { createShell } from 'choliba/core';
import { fakePlatform } from 'choliba/core/testing';
import { createCholibaShell } from 'choliba';
import { loadAgent } from 'choliba/agents';
import { loadProjectSettings } from 'choliba/projects';
import { runnerShell } from 'choliba/runner';
import { loadProjectEnv } from 'choliba/runner/env';
import { BasePage } from 'choliba/runner/pages/base-page';
import config from 'choliba/eslint';

void createShell;
void fakePlatform;
void createCholibaShell;
void loadAgent;
void loadProjectSettings;
void runnerShell;
void loadProjectEnv;
void BasePage;
void config;
`;

interface ExportEntry {
  readonly types: string;
  readonly import: string;
}

function run(command: string, args: readonly string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  try {
    return execFileSync(command, [...args], {
      cwd,
      env: env ?? process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    throw new Error(`${failed.stderr ?? ''}${failed.stdout ?? ''}`, { cause: error });
  }
}

const PACKAGE_DIRS = [
  '',
  'packages/choliba',
  'packages/core',
  'packages/agents',
  'packages/projects',
  'packages/runner',
];

function installedPackage(name: string): string {
  const found = PACKAGE_DIRS.map((pkg) => join(repo, pkg, 'node_modules', name)).find((path) => existsSync(path));
  if (found === undefined) throw new Error(`dependência ${name} não está instalada no workspace`);
  return found;
}

function linkDependencies(appModules: string, dependencies: readonly string[]): void {
  mkdirSync(appModules, { recursive: true });
  for (const name of dependencies) {
    const target = join(appModules, name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(installedPackage(name), target);
  }
}

function assertExports(out: string): void {
  const manifest = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) as {
    exports: Record<string, ExportEntry | string>;
  };
  for (const subpath of SUBPATHS) {
    expect(manifest.exports[subpath]).toBeDefined();
  }
  const core = manifest.exports['./core'];
  if (core === undefined || typeof core === 'string') throw new Error('core export');
  expect(core).toEqual({ types: './core.d.ts', import: './core.js' });
  expect(Object.keys(core)).toEqual(['types', 'import']);
  expect(manifest.exports['./package.json']).toBe('./package.json');
  expect(readFileSync(join(out, 'agents.js'), 'utf8')).toContain('__CHOLIBA_SHIPPED_DIR__');
}

describe('the installable package', () => {
  it('exports every package as a subpath Node and Bun can import, with types', () => {
    const root = mkdtempSync(join(tmpdir(), 'choliba-build-'));
    const app = join(root, 'app');
    const out = join(app, 'node_modules', 'choliba');
    try {
      run('bun', ['packages/choliba/scripts/build.ts'], repo, { ...process.env, CHOLIBA_BUILD_OUT: out });
      assertExports(out);
      const dependencies = Object.keys(
        (JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')) as { dependencies: Record<string, string> })
          .dependencies,
      );
      linkDependencies(join(app, 'node_modules'), dependencies);
      writeFileSync(join(app, 'check.mjs'), CHECKER);
      writeFileSync(join(app, 'check.ts'), TYPECHECK);
      writeFileSync(
        join(app, 'tsconfig.json'),
        `${JSON.stringify({
          compilerOptions: {
            strict: true,
            module: 'nodenext',
            moduleResolution: 'nodenext',
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: true,
          },
          files: ['check.ts'],
        })}\n`,
      );
      run('node', ['check.mjs'], app);
      run('bun', ['check.mjs'], app);
      run('node', [join(repo, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--pretty', 'false'], app);
      expect(run('bun', [join(out, 'bin', 'choliba.js'), '--help'], app)).toContain('Usage:');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 180_000);
});
