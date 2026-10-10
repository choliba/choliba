// The code standard (plan 035, skill `code-standard`) checked by ESLint, one package at a time: a package is listed
// in STRUCTURE once it follows the standard, and from then on breaking it fails `bun run lint`.
import type { Linter } from 'eslint';
import boundaries from 'eslint-plugin-boundaries';
import checkFile from 'eslint-plugin-check-file';
import { importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

/** The layers of a package's `src/`, from the bottom: a folder imports only folders of the layers below it. */
const LAYERS = ['common', 'domain', 'orchestration', 'module'] as const;
type Layer = (typeof LAYERS)[number];

/** The folders of `src/` of each package that follows the standard, by layer (`common` is always `common/`). */
const STRUCTURE: Readonly<Record<string, Partial<Record<Exclude<Layer, 'common'>, readonly string[]>>>> = {
  core: { module: ['platform', 'config', 'help', 'cli', 'theme', 'runtime', 'shell', 'testing'] },
  terminal: { module: ['terminal'] },
  projects: { domain: ['paths'], module: ['locations', 'tickets', 'projects'] },
  runner: { module: ['tests'] },
  agents: { module: ['agents', 'providers'] },
  choliba: { domain: ['help', 'runtime'], module: ['check', 'setup', 'tooling'] },
  'choliba-cli': { domain: ['help', 'runtime'], module: ['new', 'generate', 'add', 'workspace'] },
};

/** The Nest file types (`<name>.<type>.ts`): the `nest generate` schematics in use, `dto`, nest-commander's `command`, and `constants` for injection tokens. */
const NEST_TYPES = ['module', 'service', 'provider', 'decorator', 'interface', 'dto', 'command', 'constants'];

const KEBAB = '+([a-z0-9])*(-+([a-z0-9]))';

/** Every folder of `src/` the standard knows, as an element of its layer, with its package captured. */
function elements(): Record<string, unknown>[] {
  const known: Record<string, unknown>[] = [];
  for (const [pkg, layers] of Object.entries(STRUCTURE)) {
    const folders: readonly (readonly [Layer, string])[] = [
      ['common', 'common'],
      ...Object.entries(layers).flatMap(([layer, names]) => names.map((name) => [layer as Layer, name] as const)),
    ];
    for (const [layer, folder] of folders) {
      known.push({ type: layer, pattern: `packages/+(${pkg})/src/${folder}`, partialMatch: false, capture: ['pkg'] });
    }
  }
  // Last, as the first matching descriptor wins: the files right in `src/` (`index.ts`, `nest.ts`, `main.ts`,
  // `app.module.ts`) are the package's entries.
  known.push({ type: 'entry', pattern: 'packages/*/src', partialMatch: false, capture: ['pkg'] });
  return known;
}

const SAME_PACKAGE = { pkg: '{{ from.element.captured.pkg }}' };

/**
 * What a folder of `layer` may import, besides its own files: the folders of its own layer and of the layers below
 * it, in its package, always through their `index.ts` (functions and types) or `nest.ts` (modules, services,
 * commands). Folders of one layer may build on each other (`project/` on `paths/`); a cycle between them
 * is a cycle between their `index.ts` files, which `import-x/no-cycle` rejects.
 */
function allowedBelow(layer: Layer): Record<string, unknown> {
  const below = LAYERS.slice(0, LAYERS.indexOf(layer) + 1);
  return {
    from: { element: { type: layer } },
    allow: { to: { element: { type: [...below], captured: SAME_PACKAGE, fileInternalPath: '{index,nest}.ts' } } },
  };
}

/**
 * The import rules, in order (a later rule wins): no folder imports another folder or its own package's entries,
 * then each layer may import the layers below it through their `index.ts`. Another package's folders count as
 * folders, so a package is reached only through its entries (`.` and `./nest`).
 */
function dependencyRules(): Record<string, unknown>[] {
  return [
    ...LAYERS.map((layer) => ({
      from: { element: { type: layer } },
      disallow: { to: { element: { type: [...LAYERS] } } },
    })),
    ...LAYERS.map((layer) => ({
      from: { element: { type: layer } },
      disallow: { to: { element: { type: 'entry', captured: SAME_PACKAGE } } },
    })),
    ...LAYERS.map(allowedBelow),
  ];
}

/** The files of the packages that follow the standard, tests excluded. */
function sources(): string[] {
  return Object.keys(STRUCTURE).map((pkg) => `packages/${pkg}/src/**/*.ts`);
}

export function structureConfig(): Linter.Config[] {
  const files = sources();
  if (files.length === 0) return [];
  return [
    {
      files,
      ignores: ['**/__tests__/**'],
      plugins: { boundaries, 'check-file': checkFile, 'import-x': importX },
      settings: {
        'boundaries/elements': elements(),
        'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
        'import/resolver': { typescript: { alwaysTryTypes: true } },
      },
      rules: {
        'boundaries/dependencies': [
          'error',
          {
            default: 'allow',
            policies: dependencyRules(),
          },
        ],
        'import-x/no-cycle': 'error',
        'check-file/filename-naming-convention': [
          'error',
          { '**/*.ts': `${KEBAB}?(.@(${NEST_TYPES.join('|')}))` },
          { ignoreMiddleExtensions: false },
        ],
        'check-file/folder-naming-convention': ['error', { 'packages/*/src/**/': 'KEBAB_CASE' }],
      },
    },
    // What the Playwright runner loads by path, outside `src/`: public surface, so its names are kebab-case too.
    {
      files: ['packages/runner/{shared,reporters}/**/*.ts'],
      plugins: { 'check-file': checkFile },
      rules: {
        'check-file/filename-naming-convention': ['error', { '**/*.ts': KEBAB }, { ignoreMiddleExtensions: false }],
        'check-file/folder-naming-convention': ['error', { 'packages/runner/{shared,reporters}/**/': 'KEBAB_CASE' }],
      },
    },
  ];
}
