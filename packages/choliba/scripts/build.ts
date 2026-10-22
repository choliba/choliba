// Builds the installable `choliba` package into `dist/`: one bundle for the bin and every public subpath
// (`choliba`, `choliba/core`, …), shared code emitted once, the declaration files next to each entry, the
// resources the code finds from the loaded file (agent schemes, project and ticket templates) and a
// package.json listing only the external dependencies. Nothing is published: `bun pm pack` inside `dist/`
// gives a tarball to install locally. `CHOLIBA_BUILD_OUT` redirects the output (the build spec uses it).
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

interface Manifest {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly license?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
}

interface ShippedExport {
  readonly subpath: string;
  readonly js: string;
  readonly types: string;
  readonly declaration: string;
  readonly kind: 'star' | 'default';
}

const packageDir = join(import.meta.dir, '..');
const packagesDir = join(packageDir, '..');
const repoRoot = join(packagesDir, '..');
const entriesDir = join(packageDir, 'scripts', 'entries');
const BUNDLED = [
  'agents',
  'config',
  'core',
  'domain',
  'engine',
  'kernel',
  'projects',
  'runner',
  'sandbox',
  'shell',
  'tui',
  'workspace',
];

/** Set from the loaded file before its imports, so a lookup during import sees this package, not the build machine. */
const SHIPPED_DIR = 'globalThis.__CHOLIBA_SHIPPED_DIR__ = decodeURIComponent(new URL(".", import.meta.url).pathname);';

const ENTRY_FILES = [
  'bin/choliba.ts',
  'index.ts',
  'config.ts',
  'core.ts',
  'core/testing.ts',
  'agents.ts',
  'projects.ts',
  'runner.ts',
  'sandbox.ts',
  'runner/env.ts',
  'runner/pages/base-page.ts',
  'eslint.ts',
  'playwright.config.ts',
  'reporters/detailed-ticket-reporter.ts',
  'shared/global-setup.ts',
  'shared/global-teardown.ts',
];

const SHIPPED: readonly ShippedExport[] = [
  { subpath: '.', js: './index.js', types: 'index.d.ts', declaration: 'types/choliba/src/index.d.ts', kind: 'star' },
  {
    subpath: './config',
    js: './config.js',
    types: 'config.d.ts',
    declaration: 'types/config/src/index.d.ts',
    kind: 'star',
  },
  { subpath: './core', js: './core.js', types: 'core.d.ts', declaration: 'types/core/src/index.d.ts', kind: 'star' },
  {
    subpath: './core/testing',
    js: './core/testing.js',
    types: 'core/testing.d.ts',
    declaration: 'types/core/src/testing/index.d.ts',
    kind: 'star',
  },
  {
    subpath: './agents',
    js: './agents.js',
    types: 'agents.d.ts',
    declaration: 'types/agents/src/index.d.ts',
    kind: 'star',
  },
  {
    subpath: './projects',
    js: './projects.js',
    types: 'projects.d.ts',
    declaration: 'types/projects/src/index.d.ts',
    kind: 'star',
  },
  {
    subpath: './runner',
    js: './runner.js',
    types: 'runner.d.ts',
    declaration: 'types/runner/src/index.d.ts',
    kind: 'star',
  },
  {
    subpath: './sandbox',
    js: './sandbox.js',
    types: 'sandbox.d.ts',
    declaration: 'types/sandbox/src/index.d.ts',
    kind: 'star',
  },
  {
    subpath: './runner/env',
    js: './runner/env.js',
    types: 'runner/env.d.ts',
    declaration: 'types/runner/shared/env.d.ts',
    kind: 'star',
  },
  {
    subpath: './runner/pages/base-page',
    js: './runner/pages/base-page.js',
    types: 'runner/pages/base-page.d.ts',
    declaration: 'types/runner/shared/pages/base-page.d.ts',
    kind: 'star',
  },
  {
    subpath: './eslint',
    js: './eslint.js',
    types: 'eslint.d.ts',
    declaration: 'types/choliba/src/tooling/eslint-config.d.ts',
    kind: 'default',
  },
];

/** Longer prefixes first, so `@choliba/core/testing` is not rewritten as the `core` prefix plus a suffix. */
const SPECIFIERS: readonly (readonly [string, string])[] = [
  ['@choliba/core/testing', 'choliba/core/testing'],
  ['@choliba/runner/shared/pages/base-page', 'choliba/runner/pages/base-page'],
  ['@choliba/runner/shared/env', 'choliba/runner/env'],
  ['@choliba/config', 'choliba/config'],
  ['@choliba/core', 'choliba/core'],
  ['@choliba/agents', 'choliba/agents'],
  ['@choliba/projects', 'choliba/projects'],
  ['@choliba/runner', 'choliba/runner'],
  ['@choliba/sandbox', 'choliba/sandbox'],
];

/**
 * The packages bundled in but given no subpath (the restructure keeps internal packages out of the public paths): a
 * declaration that imports one reaches its declarations by a relative path inside `types/`. Longer specifiers first.
 */
const INTERNAL: readonly (readonly [string, string])[] = [
  ['@choliba/domain', join('domain', 'src', 'index.d.ts')],
  ['@choliba/engine', join('engine', 'src', 'index.d.ts')],
  ['@choliba/kernel/testing', join('kernel', 'src', 'testing', 'index.d.ts')],
  ['@choliba/kernel', join('kernel', 'src', 'index.d.ts')],
  ['@choliba/workspace', join('workspace', 'src', 'index.d.ts')],
  ['@choliba/shell/testing', join('shell', 'src', 'testing', 'index.d.ts')],
  ['@choliba/shell', join('shell', 'src', 'index.d.ts')],
  ['@choliba/tui/testing', join('tui', 'src', 'testing', 'index.d.ts')],
  ['@choliba/tui', join('tui', 'src', 'index.d.ts')],
];

function manifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
}

/** Every non-workspace dependency of this package and of the packages bundled into it. */
function externalDependencies(): Record<string, string> {
  const dependencies: Record<string, string> = {};
  for (const dir of [packageDir, ...BUNDLED.map((name) => join(packagesDir, name))]) {
    for (const [name, version] of Object.entries(manifest(dir).dependencies ?? {})) {
      if (!version.startsWith('workspace:')) dependencies[name] = version;
    }
  }
  return Object.fromEntries(Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)));
}

async function bundle(outDir: string, external: readonly string[]): Promise<void> {
  const result = await Bun.build({
    entrypoints: ENTRY_FILES.map((file) => join(entriesDir, file)),
    root: entriesDir,
    outdir: outDir,
    target: 'node',
    format: 'esm',
    splitting: true,
    external: [...external],
    banner: SHIPPED_DIR,
  });
  if (result.success) return;
  for (const log of result.logs) console.error(log);
  throw new Error('build do pacote falhou');
}

function ensureBunShebang(file: string): void {
  const text = readFileSync(file, 'utf8');
  const withShebang = text.startsWith('#!') ? text : `#!/usr/bin/env bun\n${text}`;
  writeFileSync(file, withShebang);
  chmodSync(file, 0o755);
}

function copyResources(outDir: string): void {
  cpSync(join(packagesDir, 'agents', 'schemes'), join(outDir, 'schemes'), { recursive: true });
  cpSync(join(packagesDir, 'projects', 'templates'), join(outDir, 'templates'), { recursive: true });
  cpSync(join(packageDir, 'templates', 'workspace'), join(outDir, 'templates', 'workspace'), { recursive: true });
  cpSync(join(packageDir, 'templates', 'example'), join(outDir, 'templates', 'example'), { recursive: true });
  cpSync(join(packageDir, 'assets'), join(outDir, 'assets'), { recursive: true });
  // The guide of choliba/core, next to its entry, for whoever installed the package.
  cpSync(join(packagesDir, 'core', 'README.md'), join(outDir, 'core', 'README.md'));
  // The independent configuration guide, next to its public entry.
  cpSync(join(packagesDir, 'config', 'README.md'), join(outDir, 'config', 'README.md'));
}

function runTsc(config: string, what: string): void {
  try {
    execFileSync('bun', ['x', 'tsc', '-p', config, '--pretty', 'false'], { cwd: repoRoot, stdio: 'pipe' });
  } catch (error) {
    const failed = error as { stdout?: Buffer; stderr?: Buffer };
    const detail = `${failed.stdout?.toString() ?? ''}${failed.stderr?.toString() ?? ''}`;
    throw new Error(`declarações de ${what} falharam\n${detail}`, { cause: error });
  }
}

function emitPackage(name: string, outDir: string, include: readonly string[]): void {
  const dir = join(packagesDir, name);
  const config = join(dir, 'tsconfig.emit.json');
  const source = {
    extends: './tsconfig.json',
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: join(outDir, 'types', name),
      rootDir: '.',
    },
    include,
    exclude: ['src/__tests__'],
  };
  try {
    writeFileSync(config, `${JSON.stringify(source, null, 2)}\n`);
    runTsc(config, name);
  } finally {
    rmSync(config, { force: true });
  }
}

function emitDeclarations(outDir: string): void {
  emitPackage('config', outDir, ['src']);
  emitPackage('kernel', outDir, ['src']);
  emitPackage('domain', outDir, ['src']);
  emitPackage('engine', outDir, ['src']);
  emitPackage('workspace', outDir, ['src']);
  emitPackage('shell', outDir, ['src']);
  emitPackage('tui', outDir, ['src']);
  emitPackage('core', outDir, ['src']);
  emitPackage('agents', outDir, ['src']);
  emitPackage('projects', outDir, ['src']);
  emitPackage('sandbox', outDir, ['src']);
  emitPackage('runner', outDir, ['src', 'shared', 'reporters', 'playwright.config.ts']);
  emitPackage('choliba', outDir, ['src']);
}

function declarationFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...declarationFiles(path));
      continue;
    }
    if (entry.name.endsWith('.d.ts')) found.push(path);
  }
  return found;
}

function rewriteSpecifiers(source: string): string {
  return SPECIFIERS.reduce((text, [from, to]) => {
    return text.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
  }, source);
}

/** `nodenext` resolves a relative type import only when it names the `.js` it stands in for, and a folder only through its `index.js`. */
function jsSpecifier(file: string, specifier: string): string {
  if (specifier.endsWith('.js') || specifier.endsWith('.json')) return specifier;
  const target = join(dirname(file), specifier);
  if (existsSync(`${target}.d.ts`)) return `${specifier}.js`;
  if (existsSync(join(target, 'index.d.ts'))) return `${specifier}/index.js`;
  return `${specifier}.js`;
}

/**
 * Every relative specifier of the declaration `file` as `nodenext` resolves it: in `from '…'` and in the `import("…")`
 * types the compiler writes for an inferred type, `..` and `.` alone included.
 */
function rewriteRelative(source: string, file: string): string {
  return source.replaceAll(
    /(from |import\()(['"])(\.\.?(?:\/[^'"]*)?)\2/g,
    (_match, before: string, quote: string, specifier: string) => {
      return `${before}${quote}${jsSpecifier(file, specifier)}${quote}`;
    },
  );
}

/** An internal package's specifier in the declaration `file` as the relative path to its declarations. */
function rewriteInternal(source: string, file: string, outDir: string): string {
  return INTERNAL.reduce((text, [from, declaration]) => {
    const to = declarationSpecifier(file, join(outDir, 'types', declaration));
    return text.replaceAll(`'${from}'`, `'${to}'`).replaceAll(`"${from}"`, `"${to}"`);
  }, source);
}

function rewriteDeclarations(outDir: string): void {
  for (const file of declarationFiles(join(outDir, 'types'))) {
    const internal = rewriteInternal(readFileSync(file, 'utf8'), file, outDir);
    writeFileSync(file, rewriteRelative(rewriteSpecifiers(internal), file));
  }
}

function declarationSpecifier(wrapper: string, declaration: string): string {
  const specifier = relative(dirname(wrapper), declaration)
    .replaceAll('\\', '/')
    .replace(/\.d\.ts$/, '');
  const rooted = specifier.startsWith('.') ? specifier : `./${specifier}`;
  return `${rooted}.js`;
}

function writeWrappers(outDir: string): void {
  for (const item of SHIPPED) {
    const wrapper = join(outDir, item.types);
    const specifier = declarationSpecifier(wrapper, join(outDir, item.declaration));
    const line =
      item.kind === 'default' ? `export { default } from '${specifier}';\n` : `export * from '${specifier}';\n`;
    mkdirSync(dirname(wrapper), { recursive: true });
    writeFileSync(wrapper, line);
  }
}

/**
 * The version of this build: the package.json one (the base, `0.0.1-dev`), or `CHOL_VERSION` from the release
 * workflow, a SemVer pre-release of that base (`0.0.1-dev.44`). `CHOL_GIT_HEAD` is the commit, for `--version`.
 */
function buildVersion(base: string): string {
  const version = process.env['CHOL_VERSION'];
  if (version === undefined || version === '') return base;
  if (!new RegExp(`^${base.replaceAll('.', '\\.')}\\.\\d+$`).test(version)) {
    throw new Error(`CHOL_VERSION=${version} não é ${base}.<número>`);
  }
  return version;
}

function exportMap(): Record<string, { readonly types: string; readonly import: string } | string> {
  const exports: Record<string, { readonly types: string; readonly import: string } | string> = {};
  for (const item of SHIPPED) {
    exports[item.subpath] = { types: `./${item.types}`, import: item.js };
  }
  exports['./package.json'] = './package.json';
  return exports;
}

function writeManifest(outDir: string, dependencies: Record<string, string>): string {
  const own = manifest(packageDir);
  const root = manifest(repoRoot);
  const version = buildVersion(own.version ?? '0.0.0');
  const gitHead = process.env['CHOL_GIT_HEAD'];
  writeFileSync(
    join(outDir, 'package.json'),
    `${JSON.stringify(
      {
        name: own.name,
        version,
        ...(gitHead === undefined || gitHead === '' ? {} : { gitHead }),
        description: own.description,
        license: root.license,
        type: 'module',
        bin: { choliba: 'bin/choliba.js' },
        exports: exportMap(),
        // Builds the workspace (folders, .env, .gitignore) and turns bash completion on. Bun runs it only
        // for trusted packages: `bun add --trust choliba`, or `bun choliba setup` afterwards.
        scripts: { postinstall: 'bun bin/choliba.js setup' },
        engines: { bun: '>=1.2' },
        dependencies,
      },
      null,
      2,
    )}\n`,
  );
  return version;
}

const outDir = process.env['CHOLIBA_BUILD_OUT'] ?? join(packageDir, 'dist');
const dependencies = externalDependencies();
rmSync(outDir, { recursive: true, force: true });
await bundle(outDir, Object.keys(dependencies));
ensureBunShebang(join(outDir, 'bin', 'choliba.js'));
copyResources(outDir);
emitDeclarations(outDir);
rewriteDeclarations(outDir);
writeWrappers(outDir);
const version = writeManifest(outDir, dependencies);
console.log(`choliba ${version} em ${outDir}`);
