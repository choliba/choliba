import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

import ts from 'typescript';

/**
 * Playwright loads its config, the shared hooks, the reporters and everything they import straight from the
 * sources, compiled by its own Babel, which rejects parameter decorators (`@Inject(...)` in a constructor). So
 * nothing it reaches may use a decorator. Every package has one entry, `.`, and this spec walks what Playwright
 * loads. Jest (ts-jest) would accept a decorator, so without this spec a slip only shows up when `choliba tests`
 * runs.
 */

const RUNNER = resolve(__dirname, '..', '..');
const PACKAGES = resolve(RUNNER, '..');

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `@choliba/<name>` → its package folder and `exports` map. */
function workspacePackages(): ReadonlyMap<string, { readonly dir: string; readonly exports: Record<string, string> }> {
  const found = new Map<string, { readonly dir: string; readonly exports: Record<string, string> }>();
  for (const name of readdirSync(PACKAGES)) {
    const manifestFile = join(PACKAGES, name, 'package.json');
    if (!existsSync(manifestFile)) continue;
    const manifest: unknown = JSON.parse(readFileSync(manifestFile, 'utf8'));
    if (!isRecord(manifest) || typeof manifest['name'] !== 'string' || !isRecord(manifest['exports'])) continue;
    const exports: Record<string, string> = {};
    for (const [key, target] of Object.entries(manifest['exports'])) {
      if (typeof target === 'string') exports[key] = target;
    }
    found.set(manifest['name'], { dir: join(PACKAGES, name), exports });
  }
  return found;
}

const PACKAGE_MAP = workspacePackages();

function asFile(candidate: string): string | undefined {
  for (const file of [candidate, `${candidate}.ts`, join(candidate, 'index.ts')]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return undefined;
}

/** The file an import names, for the workspace's own code; `undefined` for Node and third-party modules. */
function resolveImport(specifier: string, from: string): string | undefined {
  if (specifier.startsWith('.')) return asFile(resolve(dirname(from), specifier));
  if (specifier.startsWith('@shared/')) return asFile(join(RUNNER, 'shared', specifier.slice('@shared/'.length)));
  const match = /^(@choliba\/[^/]+)(\/.*)?$/.exec(specifier);
  const [, name = '', sub = ''] = match ?? [];
  const pkg = PACKAGE_MAP.get(name);
  const target = pkg?.exports[`.${sub}`];
  return pkg === undefined || target === undefined ? undefined : asFile(join(pkg.dir, target));
}

/** Whether the declaration only brings in types (erased, so never loaded). */
function typeOnly(node: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
  if (ts.isExportDeclaration(node)) return node.isTypeOnly;
  return node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
}

interface Scan {
  readonly imports: readonly string[];
  readonly decorators: readonly number[];
}

function scan(file: string): Scan {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const imports: string[] = [];
  const decorators: number[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isDecorator(node)) {
      decorators.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && !typeOnly(node)) {
      const specifier = node.moduleSpecifier;
      if (specifier !== undefined && ts.isStringLiteral(specifier)) imports.push(specifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, decorators };
}

function filesUnder(dir: string): readonly string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

/** Every workspace file Playwright loads, each with the chain of imports that reaches it. */
function playwrightGraph(): ReadonlyMap<string, readonly string[]> {
  const entries = [join(RUNNER, 'playwright.config.ts'), ...filesUnder(join(RUNNER, 'shared'))];
  entries.push(...filesUnder(join(RUNNER, 'reporters')));
  const chains = new Map<string, readonly string[]>(entries.map((file) => [file, [file]]));
  const queue = [...entries];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const chain = chains.get(file) ?? [file];
    for (const specifier of scan(file).imports) {
      const target = resolveImport(specifier, file);
      if (target === undefined || chains.has(target)) continue;
      chains.set(target, [...chain, target]);
      queue.push(target);
    }
  }
  return chains;
}

describe('what Playwright loads', () => {
  const graph = playwrightGraph();

  it('reaches the packages it uses, so the walk is real', () => {
    const reached = [...graph.keys()].map((file) => relative(PACKAGES, file));
    expect(reached).toEqual(expect.arrayContaining(['projects/src/index.ts', 'core/src/config/index.ts']));
  });

  it('uses no decorator, directly or through an import', () => {
    const offenders = [...graph.entries()]
      .map(([file, chain]) => ({ lines: scan(file).decorators, chain }))
      .filter(({ lines }) => lines.length > 0)
      .map(({ lines, chain }) => {
        const path = chain.map((file) => relative(PACKAGES, file)).join(' → ');
        return `${path} (decorator na linha ${lines.join(', ')})`;
      });

    expect(offenders).toEqual([]);
  });
});
