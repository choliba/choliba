/**
 * Whether a round's definition imports the same Choliba that runs it. The
 * definition is the project's own file: its `import … from 'choliba'`
 * resolves from the project (its `node_modules/choliba`), and the runner may
 * be another copy (the repository's). Two copies with different code in one
 * process do not share the config, their errors are not each other's, and
 * the definition would run the other copy's `defineRound`, providers and
 * rules. Same code (or the same folder): it runs; different: a `UsageError`
 * that says where to run what, before the definition is imported.
 */

import { createHash } from 'node:crypto';

import { UsageError } from '../errors.ts';
import {
  dirname,
  isDirectory,
  join,
  listDirectory,
  pathExists,
  readText,
  realPath,
} from '../filesystem/index.ts';

/** The pages' sources: not shipped as source in the package, so not compared. */
const NOT_COMPARED = join('src', 'rounds', 'web');

/**
 * The root of the Choliba a definition imports: where `choliba` resolves
 * from its folder; `undefined` when it does not import the package.
 */
export function installedCholiba(definitionFile: string): string | undefined {
  try {
    return dirname(
      Bun.resolveSync('choliba/package.json', dirname(definitionFile)),
    );
  } catch {
    return undefined;
  }
}

/** Every `.ts` under `dir`, as paths relative to `root`, sorted. */
function sourcesUnder(root: string, dir: string): string[] {
  return listDirectory(join(root, dir)).flatMap((name) => {
    const relative = join(dir, name);
    if (relative === NOT_COMPARED || name === 'node_modules') return [];
    if (isDirectory(join(root, relative))) return sourcesUnder(root, relative);
    return name.endsWith('.ts') ? [relative] : [];
  });
}

/** What a Choliba's code is: a sha256 of its `src/**\/*.ts`, path and content. */
export function cholibaFingerprint(root: string): string {
  const hash = createHash('sha256');
  if (!pathExists(join(root, 'src'))) return hash.digest('hex');
  for (const file of sourcesUnder(root, 'src').toSorted()) {
    hash.update(`${file}\0${readText(join(root, file))}\0`);
  }
  return hash.digest('hex');
}

/** Whether a value is a JSON object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A field of a JSON object, when it is one. */
const field = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

/** The `version` of a Choliba's package.json; `?` when it has none. */
function versionOf(root: string): string {
  try {
    const version = field(
      JSON.parse(readText(join(root, 'package.json'))),
      'version',
    );
    return typeof version === 'string' ? version : '?';
  } catch {
    return '?';
  }
}

/** The project's `package.json` above `start`: the folder it is in, and how it asks for `choliba`. */
function projectOf(
  start: string,
): { readonly dir: string; readonly spec: string | undefined } | undefined {
  let dir = start;
  while (true) {
    const file = join(dir, 'package.json');
    if (pathExists(file)) {
      try {
        const parsed: unknown = JSON.parse(readText(file));
        const spec = [
          field(field(parsed, 'dependencies'), 'choliba'),
          field(field(parsed, 'devDependencies'), 'choliba'),
        ].find((value): value is string => typeof value === 'string');
        return { dir, spec };
      } catch {
        return { dir, spec: undefined };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** The commands that make the project's Choliba the running one, each with its folder. */
export function reinstallSteps(
  running: string,
  project: { readonly dir: string; readonly spec: string | undefined },
): string[] {
  const { dir, spec } = project;
  // Removed first: with the same name, `bun add` alone keeps the package
  // its bun.lock pins (its hash), and nothing changes.
  if (spec !== undefined && spec.endsWith('.tgz')) {
    // The project installs a package file: made again from the running
    // Choliba, with the same name, and installed again.
    const file = spec.replace(/^file:/, '');
    return [
      `cd ${running} && bun pm pack --filename ${file}`,
      `cd ${dir} && bun remove choliba && bun add ${file}`,
    ];
  }
  return [`cd ${dir} && bun remove choliba && bun add ${running}`];
}

/**
 * Stops a round whose definition imports a Choliba with other code than the
 * running one (`running`, its root): a `UsageError` with both folders and
 * the commands to run. Nothing to compare (no `choliba` import), the same
 * folder or the same code: nothing.
 */
export function checkSameCholiba(
  definitionFile: string,
  running: string,
): void {
  const installed = installedCholiba(definitionFile);
  if (installed === undefined) return;
  if (realPath(installed) === realPath(running)) return;
  if (cholibaFingerprint(installed) === cholibaFingerprint(running)) return;
  // <project>/node_modules/choliba: the project's package.json is above it.
  const project = projectOf(dirname(installed)) ?? {
    dir: dirname(definitionFile),
    spec: undefined,
  };
  const steps = reinstallSteps(running, project);
  throw new UsageError(
    [
      `A definição ${definitionFile} importa outro Choliba, com código diferente do que roda a rodada:`,
      `  importa: ${installed} (${versionOf(installed)})`,
      `  roda:    ${running} (${versionOf(running)})`,
      'Com duas versões no mesmo processo, a config e os erros de uma não valem na outra, e a definição usaria o defineRound, os providers e as regras da outra versão. Nada rodou.',
      'Instale no projeto o Choliba que roda:',
      ...steps.map((step) => `  ${step}`),
    ].join('\n'),
  );
}
