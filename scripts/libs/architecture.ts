// What the restructure (plans 12–28) holds the packages to: which package imports which, and what each entry
// exports. Both are read from the code and compared with the lists in `scripts/architecture/`, so a change to either
// shows in a pull request's diff and is made on purpose.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

/** The packages each package imports, from its production code, and the ones its package.json depends on. */
export interface PackageEdges {
  readonly imports: readonly string[];
  readonly declared: readonly string[];
}

/** Each package's edges, by its name (`@choliba/core`, `choliba`). */
export type PackageGraph = Readonly<Record<string, PackageEdges>>;

/** The names each entry exports, values and types alike, by its specifier (`@choliba/core/testing`). */
export type EntryExports = Readonly<Record<string, readonly string[]>>;

interface Manifest {
  readonly name: string;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly exports?: Readonly<Record<string, string>>;
}

/**
 * Production code outside `src/`: what Playwright loads by path (the runner's config, shared files and reporters) and
 * the files the app's build republishes each entry from (`scripts/entries/`).
 */
const OUTSIDE_SRC = ['playwright.config.ts', 'shared', 'reporters', join('scripts', 'entries')];

/** A specifier of another package of the repository, in an import, an export or a dynamic import. */
const SPECIFIER = /(?:from\s+|import\s*\(\s*|import\s+)['"](@choliba\/[a-z-]+|choliba)(?:\/[^'"]*)?['"]/g;

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest;
}

function packageDirs(root: string): string[] {
  const packages = join(root, 'packages');
  return readdirSync(packages)
    .map((name) => join(packages, name))
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .sort();
}

/** The production `.ts` files under `path`: no spec, no `__tests__/`, no `node_modules/`. */
function sourceFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return path.endsWith('.ts') ? [path] : [];
  return readdirSync(path)
    .filter((name) => name !== '__tests__' && name !== 'node_modules' && !name.endsWith('.spec.ts'))
    .flatMap((name) => sourceFiles(join(path, name)));
}

function importedPackages(files: readonly string[], self: string): string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIER)) {
      const name = match[1];
      if (name !== undefined && name !== self) found.add(name);
    }
  }
  return [...found].sort();
}

/** Who imports whom among the packages of `root`, and what each package.json declares. */
export function packageGraph(root: string): PackageGraph {
  const graph: Record<string, PackageEdges> = {};
  for (const dir of packageDirs(root)) {
    const manifest = readManifest(dir);
    const files = [join(dir, 'src'), ...OUTSIDE_SRC.map((path) => join(dir, path))].flatMap(sourceFiles);
    const declared = Object.keys(manifest.dependencies ?? {})
      .filter((name) => name === 'choliba' || name.startsWith('@choliba/'))
      .sort();
    graph[manifest.name] = { imports: importedPackages(files, manifest.name), declared };
  }
  return graph;
}

/** Each entry of the packages of `root` (`exports` of its package.json, `src/index.ts` for the app) and its file. */
export function packageEntries(root: string): Readonly<Record<string, string>> {
  const entries: Record<string, string> = {};
  for (const dir of packageDirs(root)) {
    const manifest = readManifest(dir);
    const exported = manifest.exports ?? {};
    if (exported['.'] === undefined) entries[manifest.name] = join(dir, 'src', 'index.ts');
    for (const [subpath, file] of Object.entries(exported)) {
      if (!file.endsWith('.ts')) continue;
      entries[subpath === '.' ? manifest.name : `${manifest.name}/${subpath.slice(2)}`] = join(dir, file);
    }
  }
  return entries;
}

/** The names each entry of `root` exports, sorted, read by the TypeScript compiler from the repository's config. */
export function entryExports(root: string): EntryExports {
  const entries = packageEntries(root);
  const config = ts.getParsedCommandLineOfConfigFile(
    join(root, 'tsconfig.base.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => undefined,
    },
  );
  const program = ts.createProgram(Object.values(entries), { ...config?.options, noEmit: true });
  const checker = program.getTypeChecker();
  const exports: Record<string, readonly string[]> = {};
  for (const [specifier, file] of Object.entries(entries)) {
    const source = program.getSourceFile(file);
    const symbol = source === undefined ? undefined : checker.getSymbolAtLocation(source);
    exports[specifier] =
      symbol === undefined
        ? []
        : checker
            .getExportsOfModule(symbol)
            .map((exported) => exported.getName())
            .sort();
  }
  return exports;
}

/** The packages whose imports and package.json disagree, in words; none when every one declares what it imports. */
export function undeclaredEdges(graph: PackageGraph): string[] {
  return Object.entries(graph).flatMap(([name, { imports, declared }]) => {
    const missing = imports.filter((dependency) => !declared.includes(dependency));
    const unused = declared.filter((dependency) => !imports.includes(dependency));
    return [
      ...missing.map((dependency) => `${name} importa ${dependency}, que o package.json não declara`),
      ...unused.map((dependency) => `${name} declara ${dependency}, que não importa`),
    ];
  });
}

/** The edges of `graph`, as `A → B` lines, for the list that is checked in. */
export function edgeLines(graph: PackageGraph): string[] {
  return Object.entries(graph).flatMap(([name, { imports }]) => imports.map((dependency) => `${name} → ${dependency}`));
}

/** Where the checked-in lists live, from the repository's root. */
export const GRAPH_FILE = join('scripts', 'architecture', 'package-graph.txt');
export const EXPORTS_FILE = join('scripts', 'architecture', 'entry-exports.json');

/** The package graph as the checked-in list writes it: one `A → B` per line. */
export function graphText(graph: PackageGraph): string {
  return `${edgeLines(graph).sort().join('\n')}\n`;
}

/** What each entry exports as the checked-in list writes it: JSON, entries and names sorted. */
export function exportsText(exports: EntryExports): string {
  const sorted = Object.fromEntries(Object.entries(exports).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
