import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const repo = join(__dirname, '..', '..');
const CONFIG_EXAMPLE = readFileSync(join(repo, 'packages', 'config', 'examples', 'config.ts'), 'utf8');
const LIBRARY_GUIDE = readFileSync(join(repo, 'docs', 'guias', 'usar-biblioteca.md'), 'utf8');

/** The library guide's example a workspace runs as `choliba.ts`: the block under `<!-- exemplo-instalado: choliba.ts -->`. */
function installedExample(guide: string): string {
  const example = /<!-- exemplo-instalado: choliba\.ts -->\n\n```ts\n([\s\S]*?)```/.exec(guide)?.[1];
  if (example === undefined) throw new Error('o guia da biblioteca não tem o exemplo instalado (choliba.ts)');
  return example;
}

const CHOLIBA_EXAMPLE = installedExample(LIBRARY_GUIDE);

/** A workspace's agent, as the facade example lists it. */
const ECHO_AGENT = `version: 1
agent:
  id: echo
  name: Echo
  version: 1.0.0
  description: Repete a tarefa.
models: [modelo-a]
role: Repete.
context: [Nada.]
input: A tarefa.
flow: 1. Repita.
output: A tarefa.
notes: [Fixture.]
permissions:
  deny:
    write: [agents/]
`;

const SUBPATHS = [
  '.',
  './config',
  './core',
  './core/testing',
  './agents',
  './projects',
  './runner',
  './sandbox',
  './runner/env',
  './runner/pages/base-page',
  './eslint',
  './package.json',
];

const CHECKER = `import { defineConfig } from 'choliba/config';
import { createShell } from 'choliba/core';
import { fakePlatform } from 'choliba/core/testing';
import { createCholibaShell } from 'choliba';
import { loadAgent } from 'choliba/agents';
import { loadProjectSettings } from 'choliba/projects';
import { runnerShell } from 'choliba/runner';
import { createSandboxBackend } from 'choliba/sandbox';
import { loadProjectEnv } from 'choliba/runner/env';
import { BasePage } from 'choliba/runner/pages/base-page';
import config from 'choliba/eslint';

const values = [
  defineConfig,
  createShell,
  fakePlatform,
  createCholibaShell,
  loadAgent,
  loadProjectSettings,
  createSandboxBackend,
  loadProjectEnv,
  BasePage,
];
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

const TYPECHECK = `import { defineConfig, type ConfigSource } from 'choliba/config';
import { createShell } from 'choliba/core';
import { fakePlatform } from 'choliba/core/testing';
import { createCholibaShell } from 'choliba';
import { loadAgent } from 'choliba/agents';
import { loadProjectSettings } from 'choliba/projects';
import { runnerShell } from 'choliba/runner';
import { createSandboxBackend } from 'choliba/sandbox';
import { loadProjectEnv } from 'choliba/runner/env';
import { BasePage } from 'choliba/runner/pages/base-page';
import config from 'choliba/eslint';

const source: ConfigSource = { name: 'test', layout: 'flat', read: () => undefined };
void defineConfig;
void source;
void createShell;
void fakePlatform;
void createCholibaShell;
void loadAgent;
void loadProjectSettings;
void createSandboxBackend;
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
  'packages/config',
  'packages/core',
  'packages/agents',
  'packages/projects',
  'packages/runner',
  'packages/sandbox',
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
  expect(manifest.exports['./config']).toEqual({ types: './config.d.ts', import: './config.js' });
  expect(manifest.exports['./package.json']).toBe('./package.json');
  expect(readFileSync(join(out, 'agents.js'), 'utf8')).toContain('__CHOLIBA_SHIPPED_DIR__');
  expect(readFileSync(join(out, 'core', 'README.md'), 'utf8')).toBe(
    readFileSync(join(repo, 'packages', 'core', 'README.md'), 'utf8'),
  );
  const configGuide = readFileSync(join(repo, 'packages', 'config', 'README.md'), 'utf8');
  expect(readFileSync(join(out, 'config', 'README.md'), 'utf8')).toBe(configGuide);
  expect(configGuide).toContain(`\`\`\`ts\n${CONFIG_EXAMPLE}\`\`\``);
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
      writeFileSync(join(app, 'config.ts'), CONFIG_EXAMPLE);
      writeFileSync(join(app, '.env'), 'EXAMPLE_NAME=from-dotenv\n');
      writeFileSync(join(app, 'settings.yaml'), 'server:\n  port: 4321\n');
      writeFileSync(join(app, 'package.json'), '{ "type": "module", "dependencies": { "choliba": "*" } }\n');
      writeFileSync(join(app, 'choliba.ts'), CHOLIBA_EXAMPLE);
      mkdirSync(join(app, '.choliba', 'agents', 'echo'), { recursive: true });
      writeFileSync(join(app, '.choliba', 'agents', 'echo', 'agent.yaml'), ECHO_AGENT);
      mkdirSync(join(app, '.choliba', 'skills', 'repeat'), { recursive: true });
      writeFileSync(join(app, '.choliba', 'skills', 'repeat', 'SKILL.md'), '---\ndescription: Repete.\n---\n');
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
            // `@types/bun` only points at `bun-types`, which is not installed. `process` comes from `@types/node`.
            types: ['node'],
            typeRoots: [join(repo, 'node_modules', '@types')],
          },
          files: ['check.ts', 'config.ts', 'choliba.ts'],
        })}\n`,
      );
      run('node', ['check.mjs'], app);
      run('bun', ['check.mjs'], app);
      expect(run('bun', ['config.ts'], app)).toBe('{"name":"from-dotenv","port":4321}\n');
      expect(run('bun', [join(app, 'choliba.ts')], join(app, '.choliba'))).toBe(
        `raiz: ${app}\nproviders: claude, claude-ollama, cursor\nagentes em ${join(app, '.choliba', 'agents')}\n- echo 1.0.0\nskill repeat: Repete.\n`,
      );
      run('node', [join(repo, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--pretty', 'false'], app);
      expect(run('bun', [join(out, 'bin', 'choliba.js'), '--help'], app)).toContain('Usage:');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 180_000);
});
