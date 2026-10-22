import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  EXPORTS_FILE,
  entryExports,
  exportsText,
  GRAPH_FILE,
  graphText,
  packageEntries,
  packageGraph,
  undeclaredEdges,
} from '../libs/architecture';

const ROOT = join(__dirname, '..', '..');
const UPDATE = 'Se a mudança é de propósito, rode `bun run arch:update` e mande as listas no PR.';

describe('the architecture of the packages', () => {
  it('imports between packages only as the checked-in graph says', () => {
    const graph = packageGraph(ROOT);

    expect({ graph: graphText(graph), how: UPDATE }).toEqual({
      graph: readFileSync(join(ROOT, GRAPH_FILE), 'utf8'),
      how: UPDATE,
    });
    expect(undeclaredEdges(graph)).toEqual([]);
  });

  it('exports from each entry only the names the checked-in list has', () => {
    const listed: unknown = JSON.parse(readFileSync(join(ROOT, EXPORTS_FILE), 'utf8'));

    expect({ exports: entryExports(ROOT), how: UPDATE }).toEqual({ exports: listed, how: UPDATE });
  }, 30_000);

  it('forbids the engine from importing a provider', () => {
    const graph = packageGraph(ROOT);

    expect(graph['@choliba/engine']?.imports ?? []).not.toContain('@choliba/providers');
  });

  it('keeps panel and terminal drawing out of the agent run', () => {
    const run = readFileSync(join(ROOT, 'packages/agents/src/agents/runs/run-agent.ts'), 'utf8');

    expect(run).not.toMatch(/openPanel|panel\.write|frameTop|frameLines|frameBottom|summaryLine/);
  });

  it('keeps panel commands and their registration in tui', () => {
    const packages = ['agents', 'projects'];
    const sources = packages.flatMap((name) => productionFiles(join(ROOT, 'packages', name, 'src')));
    const commands = sources.filter((file) => readFileSync(file, 'utf8').includes('PanelCommand'));
    const shells = packages.map((name) =>
      readFileSync(join(ROOT, 'packages', name, 'src', name, `${name}-shell.ts`), 'utf8'),
    );

    expect(commands).toEqual([]);
    expect(shells).not.toContainEqual(expect.stringMatching(/\bpanel(?:Start)?:/));
  });

  it('keeps CLI commands and their specs in the app', () => {
    const packages = ['agents', 'projects', 'runner'];
    const sources = packages.flatMap((name) => productionFiles(join(ROOT, 'packages', name, 'src')));
    const commandSpecs = new Set(['agents-spec.ts', 'projects-spec.ts', 'tests-spec.ts']);
    const outsideApp = sources.filter((file) => {
      const name = basename(file);
      return name.endsWith('.command.ts') || commandSpecs.has(name);
    });

    expect(outsideApp).toEqual([]);
  });
});

/** Production TypeScript files below `path`, without specs. */
function productionFiles(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const file = join(path, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : productionFiles(file);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [file] : [];
  });
}

/** A repository with `packages/<dir>/` per entry of `packages`, each a package.json and its files. */
function withRepo(
  packages: Readonly<Record<string, { manifest: object; files: Readonly<Record<string, string>> }>>,
  check: (root: string) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), 'architecture-'));
  try {
    writeFileSync(join(root, 'tsconfig.base.json'), JSON.stringify({ compilerOptions: { strict: true } }));
    for (const [dir, { manifest, files }] of Object.entries(packages)) {
      const base = join(root, 'packages', dir);
      mkdirSync(base, { recursive: true });
      writeFileSync(join(base, 'package.json'), JSON.stringify(manifest));
      for (const [file, text] of Object.entries(files)) {
        mkdirSync(join(base, file, '..'), { recursive: true });
        writeFileSync(join(base, file), text);
      }
    }
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('packageGraph and entryExports', () => {
  it('read the imports of production code only, and say what package.json leaves out or adds', () => {
    withRepo(
      {
        a: {
          manifest: {
            name: '@choliba/a',
            dependencies: { '@choliba/c': 'workspace:*' },
            exports: { '.': './src/index.ts' },
          },
          files: {
            'src/index.ts': "export { b } from '@choliba/b';\nexport type { X } from './x';\n",
            'src/x.ts': "export interface X { readonly y: number }\nexport const self = import('@choliba/a');\n",
            'src/__tests__/a.spec.ts': "import { c } from '@choliba/c';\n",
            'shared/env.ts': "import '@choliba/b/testing';\n",
          },
        },
        b: {
          manifest: { name: '@choliba/b', exports: { '.': './src/index.ts' } },
          files: { 'src/index.ts': 'export const b = 1;\n' },
        },
      },
      (root) => {
        const graph = packageGraph(root);

        expect(graph).toEqual({
          '@choliba/a': { imports: ['@choliba/b'], declared: ['@choliba/c'] },
          '@choliba/b': { imports: [], declared: [] },
        });
        expect(undeclaredEdges(graph)).toEqual([
          '@choliba/a importa @choliba/b, que o package.json não declara',
          '@choliba/a declara @choliba/c, que não importa',
        ]);
        expect(graphText(graph)).toBe('@choliba/a → @choliba/b\n');
      },
    );
  });

  it('list the names each entry exports, the app with no "." entry by its src/index.ts', () => {
    withRepo(
      {
        app: {
          manifest: { name: 'choliba', exports: { './eslint': './src/eslint.ts', './package.json': './package.json' } },
          files: {
            'src/index.ts': 'export const run = 1;\nexport type Kind = string;\n',
            'src/eslint.ts': 'export default {};\n',
          },
        },
      },
      (root) => {
        expect(packageEntries(root)).toEqual({
          choliba: join(root, 'packages', 'app', 'src', 'index.ts'),
          'choliba/eslint': join(root, 'packages', 'app', 'src', 'eslint.ts'),
        });
        expect(entryExports(root)).toEqual({ choliba: ['Kind', 'run'], 'choliba/eslint': ['default'] });
        expect(exportsText({ b: ['y'], a: ['x'] })).toBe('{\n  "a": [\n    "x"\n  ],\n  "b": [\n    "y"\n  ]\n}\n');
      },
    );
  });
});
