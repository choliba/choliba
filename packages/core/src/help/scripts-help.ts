import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import type { CommandEntry, CommandSpec } from './interfaces/help.interface';
import { PACKAGE_FILE } from '../config';

export interface PackageScripts {
  readonly scripts: Readonly<Record<string, string>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads `scripts` from a parsed package.json. */
export function readPackageScripts(json: unknown): PackageScripts {
  const pkg = isRecord(json) ? json : {};
  const rawScripts = isRecord(pkg['scripts']) ? pkg['scripts'] : {};
  return {
    scripts: Object.fromEntries(
      Object.entries(rawScripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  };
}

/** npm/bun lifecycle scripts: run by the package manager, not by hand, so they stay out of the help. */
const LIFECYCLE_SCRIPTS: readonly string[] = [
  'preinstall',
  'install',
  'postinstall',
  'preuninstall',
  'uninstall',
  'postuninstall',
  'prepublish',
  'prepublishOnly',
  'prepack',
  'postpack',
  'prepare',
];

/** Group used for scripts that share no prefix with another script. */
export const OTHER_GROUP = 'Outros';

export interface ScriptFile {
  /** The file a script runs, relative to the repo root. */
  readonly file: string;
  /** Arguments the script chain fixes before the user's own (e.g. `--docs-updater`). */
  readonly args: readonly string[];
}

export interface ScriptCli extends ScriptFile {
  /** Name of the package that owns the CLI, without its scope (e.g. `agents`). */
  readonly packageName: string;
}

/**
 * Follows a script through the package.json chain to the repo file it runs, e.g. `chol:docs` →
 * `bun chol:agents --docs-updater` → `bun packages/agents/src/cli/main.ts --docs-updater`. Anything that
 * does not end in an existing .js/.ts file of the repo (prettier, jest, eslint) gives `undefined`.
 */
export function resolveScriptFile(
  scripts: Readonly<Record<string, string>>,
  name: string,
  repoRoot: string,
): ScriptFile | undefined {
  let tokens = (scripts[name] ?? '').trim().split(/\s+/);
  for (let hop = 0; hop < 10; hop += 1) {
    if (tokens[0] === 'bun') {
      tokens = tokens.slice(1);
    }
    if (tokens[0] === 'run') {
      tokens = tokens.slice(1);
    }
    const [head = '', ...rest] = tokens;
    const next = scripts[head];
    if (next !== undefined) {
      tokens = [...next.trim().split(/\s+/), ...rest];
      continue;
    }
    if (!/\.[cm]?[jt]s$/.test(head) || !existsSync(join(repoRoot, head))) {
      return undefined;
    }
    return { file: head, args: rest };
  }
  return undefined;
}

/**
 * The repo CLI a script runs: a script file whose package sets `"cholCompletion": true`, since only
 * those answer `--help`, `__complete` and `__describe`.
 */
export function resolveScriptCli(
  scripts: Readonly<Record<string, string>>,
  name: string,
  repoRoot: string,
): ScriptCli | undefined {
  const target = resolveScriptFile(scripts, name, repoRoot);
  if (target === undefined) {
    return undefined;
  }
  const packageName = optedInPackage(join(repoRoot, target.file), repoRoot);
  return packageName === undefined ? undefined : { ...target, packageName };
}

/** Name (without scope) of the nearest package.json above `file`, if it sets `"cholCompletion": true`. */
function optedInPackage(file: string, repoRoot: string): string | undefined {
  const root = resolve(repoRoot);
  let dir = dirname(resolve(file));
  while (!existsSync(join(dir, PACKAGE_FILE)) && dir !== root) {
    dir = dirname(dir);
  }
  if (!existsSync(join(dir, PACKAGE_FILE))) {
    return undefined;
  }
  const pkg: unknown = JSON.parse(readFileSync(join(dir, PACKAGE_FILE), 'utf8'));
  if (!isRecord(pkg) || pkg['cholCompletion'] !== true) {
    return undefined;
  }
  const name = typeof pkg['name'] === 'string' ? pkg['name'] : basename(dir);
  return name.replace(/^@[^/]+\//, '');
}

/** First sentence of the `/** ... *\/` block at the top of a file, if it has one. */
export function fileSummary(repoRoot: string, file: string): string | undefined {
  const body = /^\s*\/\*\*([\s\S]*?)\*\//.exec(readFileSync(join(repoRoot, file), 'utf8'))?.[1];
  if (body === undefined) {
    return undefined;
  }
  const text = body
    .replaceAll(/^\s*\*?/gm, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  const end = text.indexOf('. ');
  return end === -1 ? text : text.slice(0, end + 1);
}

/** What a plain script does, from its source: the file's top comment, else the command itself. */
export function scriptSummary(scripts: Readonly<Record<string, string>>, name: string, repoRoot: string): string {
  const target = resolveScriptFile(scripts, name, repoRoot);
  return (target === undefined ? undefined : fileSummary(repoRoot, target.file)) ?? scripts[name] ?? '';
}

/**
 * The help of `bun chol:help`, in the layout of `docker --help`, with nothing written by hand: a
 * script that runs a repo CLI is described by the CLI (`describeCli`, i.e. its `__describe`) and
 * grouped by its package; a script that runs one of our files is described by that file's top
 * comment; anything else shows its own command. Those two are grouped by the name prefix before
 * `:` when another script shares it (`test`, `test:cov`), and under `OTHER_GROUP` otherwise.
 */
export function scriptsHelpSpec(
  pkg: PackageScripts,
  repoRoot: string,
  describeCli: (cli: ScriptCli) => string,
): CommandSpec {
  const visible = Object.keys(pkg.scripts).filter((name) => !LIFECYCLE_SCRIPTS.includes(name));
  const prefix = (name: string): string => name.replace(/:.*$/, '');
  const sharesPrefix = (name: string): boolean => visible.filter((other) => prefix(other) === prefix(name)).length > 1;

  const entries: CommandEntry[] = visible.map((name) => {
    const spec = { usage: `bun run ${name}` };
    const cli = resolveScriptCli(pkg.scripts, name, repoRoot);
    if (cli !== undefined) {
      return { name, description: `${describeCli(cli)} (--help)`.trim(), group: cli.packageName, spec };
    }
    const group = sharesPrefix(name) ? prefix(name) : OTHER_GROUP;
    return { name, description: scriptSummary(pkg.scripts, name, repoRoot), group, spec };
  });
  const ordered = [
    ...entries.filter((entry) => entry.group !== OTHER_GROUP),
    ...entries.filter((entry) => entry.group === OTHER_GROUP),
  ];

  return {
    usage: 'bun run SCRIPT [ARGS]',
    description: 'Scripts do monorepo choliba.',
    commands: () => ordered,
    footer: "Run 'bun chol:help SCRIPT' for more information on a script.",
  };
}
