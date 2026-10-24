import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  EXPORTS_FILE,
  entryExports,
  escapingImports,
  exportsText,
  GRAPH_FILE,
  graphText,
  packageEntries,
  packageGraph,
  undeclaredEdges,
} from '../libs/architecture';

const ROOT = join(__dirname, '..', '..');
const UPDATE = 'Se a mudança é de propósito, rode `bun run arch:update` e mande as listas no PR.';

/** The relative imports allowed to leave their package, each with why. */
const ESCAPES_ALLOWED: Readonly<Record<string, string>> = {
  // The build republishes the files Playwright loads by path from the runner's own sources.
  'packages/choliba/scripts/entries/playwright.config.ts: ../../../runner/playwright.config': 'build entry',
  'packages/choliba/scripts/entries/reporters/detailed-ticket-reporter.ts: ../../../../runner/reporters/detailed-ticket-reporter':
    'build entry',
  'packages/choliba/scripts/entries/shared/global-setup.ts: ../../../../runner/shared/global-setup': 'build entry',
  'packages/choliba/scripts/entries/shared/global-teardown.ts: ../../../../runner/shared/global-teardown':
    'build entry',
  // These spy on engine modules and load agents with the app's loader; they leave the list with #320.
  'packages/choliba/src/__tests__/agents/runs/run-agents.spec.ts: ../../../../../engine/src/steps/git-working-tree-diff':
    '#320',
  'packages/choliba/src/__tests__/agents/runs/run-agents.spec.ts: ../../../../../engine/src/steps/step-actions': '#320',
  'packages/choliba/src/__tests__/agents/steps/step-registry.spec.ts: ../../../../../engine/src/steps/git-state':
    '#320',
  'packages/choliba/src/__tests__/agents/steps/step-registry.spec.ts: ../../../../../engine/src/steps/git-working-tree-diff':
    '#320',
  'packages/choliba/src/__tests__/agents/steps/step-registry.spec.ts: ../../../../../engine/src/steps/step-actions':
    '#320',
  'packages/choliba/src/__tests__/agents/steps/step-registry.spec.ts: ../../../../../engine/src/steps/step-registry':
    '#320',
};

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

  it('reaches another package by its entry, never by a relative path into its sources, specs included', () => {
    expect(escapingImports(ROOT)).toEqual(Object.keys(ESCAPES_ALLOWED).sort());
  });

  it('forbids the engine from importing a provider', () => {
    const graph = packageGraph(ROOT);

    expect(graph['@choliba/engine']?.imports ?? []).not.toContain('@choliba/providers');
  });

  it('keeps panel and terminal drawing out of the agent run', () => {
    const run = readFileSync(join(ROOT, 'packages/choliba/src/agents/agents/runs/run-agent.ts'), 'utf8');

    expect(run).not.toMatch(/openPanel|panel\.write|frameTop|frameLines|frameBottom|summaryLine/);
  });

  it('keeps shared project panels in tui and app-specific agent panels in app composition', () => {
    const tuiSources = productionFiles(join(ROOT, 'packages/tui/src'));
    const appPanelSources = productionFiles(join(ROOT, 'packages/choliba/src/panel'));

    expect(tuiSources.some((file) => file.endsWith('/session/projects-panel.ts'))).toBe(true);
    expect(appPanelSources.some((file) => file.endsWith('/agents-panel.ts'))).toBe(true);
    expect(readFileSync(join(ROOT, 'packages/choliba/src/panel/agents-panel-shell.ts'), 'utf8')).toMatch(/\bpanel:/);
  });

  it('keeps CLI commands and their specs out of library packages', () => {
    const packages = ['tui', 'runner'];
    const sources = packages.flatMap((name) => productionFiles(join(ROOT, 'packages', name, 'src')));
    const commandSpecs = new Set(['agents-spec.ts', 'projects-spec.ts', 'tests-spec.ts']);
    const outsideApp = sources.filter((file) => {
      const name = basename(file);
      return (name.endsWith('.command.ts') && name !== 'panel.command.ts') || commandSpecs.has(name);
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

  it('find the relative imports that leave their package, in specs as well, and nothing inside it', () => {
    withRepo(
      {
        a: {
          manifest: { name: '@choliba/a' },
          files: {
            'src/index.ts': "export { x } from './x';\nexport const y = import('../shared/y');\n",
            'src/__tests__/a.spec.ts': "import { b } from '../../../b/src/b';\n",
            'shared/y.ts': "import { c } from '../../c/src/c';\n",
          },
        },
        b: { manifest: { name: '@choliba/b' }, files: { 'src/b.ts': 'export const b = 1;\n' } },
      },
      (root) => {
        expect(escapingImports(root)).toEqual([
          'packages/a/shared/y.ts: ../../c/src/c',
          'packages/a/src/__tests__/a.spec.ts: ../../../b/src/b',
        ]);
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
            'scripts/entries/core.ts': 'export const createShell = () => 0;\n',
            'scripts/entries/core/testing.ts': 'export const fakePlatform = () => 0;\n',
            'scripts/entries/agents.ts': 'export const loadAgent = () => 0;\n',
            'scripts/entries/projects.ts': 'export const readTicket = () => 0;\n',
          },
        },
      },
      (root) => {
        expect(packageEntries(root)).toEqual({
          choliba: join(root, 'packages', 'app', 'src', 'index.ts'),
          'choliba/eslint': join(root, 'packages', 'app', 'src', 'eslint.ts'),
          'choliba/core': join(root, 'packages', 'app', 'scripts/entries/core.ts'),
          'choliba/core/testing': join(root, 'packages', 'app', 'scripts/entries/core/testing.ts'),
          'choliba/agents': join(root, 'packages', 'app', 'scripts/entries/agents.ts'),
          'choliba/projects': join(root, 'packages', 'app', 'scripts/entries/projects.ts'),
        });
        expect(entryExports(root)).toEqual({
          choliba: ['Kind', 'run'],
          'choliba/eslint': ['default'],
          'choliba/core': ['createShell'],
          'choliba/core/testing': ['fakePlatform'],
          'choliba/agents': ['loadAgent'],
          'choliba/projects': ['readTicket'],
        });
        expect(exportsText({ b: ['y', 'z'], a: ['x', 'z'] })).toBe('{\n  "a": ["x", "z"],\n  "b": ["y", "z"]\n}\n');
      },
    );
  });
});
