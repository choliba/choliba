// Builds the installable `choliba` package into `dist/`: one bundle for the CLI (every @choliba/*
// package inside it), the runner files Playwright loads by path (its config, reporter and global
// hooks, which Playwright runs under Node), the resources the code finds next to itself (agent
// schemes, project and ticket templates) and a package.json listing only the external dependencies.
// Nothing is published: `bun pm pack` inside `dist/` gives a tarball to install locally.
import { chmodSync, cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Manifest {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly license?: string;
  readonly dependencies?: Readonly<Record<string, string>>;
}

const packageDir = join(import.meta.dir, '..');
const packagesDir = join(packageDir, '..');
const out = join(packageDir, 'dist');
const BUNDLED = ['agents', 'core', 'projects', 'runner', 'terminal'];

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
  return Object.fromEntries(Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)));
}

async function bundle(config: Parameters<typeof Bun.build>[0], what: string): Promise<void> {
  const result = await Bun.build(config);
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`build de ${what} falhou`);
  }
}

const dependencies = externalDependencies();
const external = Object.keys(dependencies);
rmSync(out, { recursive: true, force: true });

await bundle(
  {
    entrypoints: [join(packageDir, 'src', 'main.ts')],
    outdir: join(out, 'bin'),
    naming: 'choliba.js',
    target: 'bun',
    format: 'esm',
    external,
  },
  'bin/choliba.js',
);
chmodSync(join(out, 'bin', 'choliba.js'), 0o755);

const runnerDir = join(packagesDir, 'runner');
await bundle(
  {
    entrypoints: [
      'playwright.config.ts',
      'reporters/detailed-ticket-reporter.ts',
      'shared/global-setup.ts',
      'shared/global-teardown.ts',
    ].map((file) => join(runnerDir, file)),
    root: runnerDir,
    outdir: out,
    target: 'node',
    format: 'esm',
    external,
  },
  'runner',
);

// `choliba/eslint`: the config a workspace's eslint.config.js imports, loaded by ESLint under Node.
await bundle(
  {
    entrypoints: [join(packageDir, 'src', 'tooling', 'eslint-config.ts')],
    outdir: out,
    naming: 'eslint.js',
    target: 'node',
    format: 'esm',
    external,
  },
  'eslint.js',
);

cpSync(join(packagesDir, 'agents', 'schemes'), join(out, 'schemes'), { recursive: true });
cpSync(join(packagesDir, 'projects', 'templates'), join(out, 'templates'), { recursive: true });
cpSync(join(packageDir, 'templates', 'workspace'), join(out, 'templates', 'workspace'), { recursive: true });
cpSync(join(packageDir, 'templates', 'example'), join(out, 'templates', 'example'), { recursive: true });

const own = manifest(packageDir);
const root = manifest(join(packagesDir, '..'));

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

const version = buildVersion(own.version ?? '0.0.0');
const gitHead = process.env['CHOL_GIT_HEAD'];
writeFileSync(
  join(out, 'package.json'),
  `${JSON.stringify(
    {
      name: own.name,
      version,
      ...(gitHead === undefined || gitHead === '' ? {} : { gitHead }),
      description: own.description,
      license: root.license,
      type: 'module',
      bin: { choliba: 'bin/choliba.js' },
      exports: { './eslint': './eslint.js', './package.json': './package.json' },
      // Builds the workspace (folders, .env, .gitignore) and turns bash completion on. Bun runs it only
      // for trusted packages: `bun add --trust choliba`, or `bunx choliba setup` afterwards.
      scripts: { postinstall: 'bun bin/choliba.js setup' },
      engines: { bun: '>=1.2' },
      dependencies,
    },
    null,
    2,
  )}\n`,
);
console.log(`choliba ${version} em ${out}`);
