// Builds the installable `choliba-cli` into `dist/`: one bundle with the @choliba/* packages it uses inside, and a
// package.json with its bin and the external dependencies (Nest cannot be bundled: it requires optional packages
// at runtime), as the choliba's build does. `bun pm pack` inside `dist/` gives the tarball the release ships next
// to the choliba's.
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
const BUNDLED = ['agents', 'core', 'projects', 'terminal'];

function manifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
}

/** The base version (`0.0.1-dev`), or `CHOL_VERSION` from the release workflow (`0.0.1-dev.44`), as the choliba's. */
function buildVersion(base: string): string {
  const version = process.env['CHOL_VERSION'];
  if (version === undefined || version === '') return base;
  if (!new RegExp(`^${base.replaceAll('.', '\\.')}\\.\\d+$`).test(version)) {
    throw new Error(`CHOL_VERSION=${version} não é ${base}.<número>`);
  }
  return version;
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

const dependencies = externalDependencies();
rmSync(out, { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: [join(packageDir, 'src', 'main.ts')],
  outdir: join(out, 'bin'),
  naming: 'choliba.js',
  target: 'bun',
  format: 'esm',
  external: Object.keys(dependencies),
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  throw new Error('build de bin/choliba.js falhou');
}
chmodSync(join(out, 'bin', 'choliba.js'), 0o755);

// The resources the bundled code finds next to itself: the agent.yaml schema (`add`, `generate agent`) and the
// project and ticket templates (`generate project|ticket`), as the workspace's choliba ships them.
cpSync(join(packagesDir, 'agents', 'schemes'), join(out, 'schemes'), { recursive: true });
cpSync(join(packagesDir, 'projects', 'templates'), join(out, 'templates'), { recursive: true });

const own = manifest(packageDir);
const root = manifest(join(packagesDir, '..'));
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
      bin: { choliba: 'bin/choliba.js', chol: 'bin/choliba.js' },
      // Turns bash completion on. Bun runs it only for a trusted package; the first normal run does it
      // otherwise, the same way `choliba setup` does for the workspace package.
      scripts: { postinstall: 'bun bin/choliba.js' },
      engines: { bun: '>=1.2' },
      dependencies,
    },
    null,
    2,
  )}\n`,
);
console.log(`choliba-cli ${version} em ${out}`);
