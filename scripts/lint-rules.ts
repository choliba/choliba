/**
 * The owner rules of `.oxlintrc.json` (`no-restricted-imports` and
 * `no-restricted-properties`), from one table: each restricted import or
 * property, who owns it and the message. The base restricts everything; each
 * owner gets an override with what is its own lifted. An override replaces a
 * rule's whole configuration, so each one lists the restrictions of all the
 * others: written by hand, a new restriction would go into the base and into
 * every override. `bun run lint:owners` writes them; a test checks the file is
 * what the table gives.
 */

import { UsageError } from '../src/errors';

const FILESYSTEM = 'src/filesystem/**/*.ts';
const EXECUTE = 'src/execute/**/*.ts';
const INPUT = 'src/input/**/*.ts';
const MCP = 'src/mcp/**/*.ts';
const STORE = 'src/store/**/*.ts';
const PROCESS = 'src/execute/process.ts';
const STDIO = 'src/output/stdio.ts';

/**
 * The owners, in the order of their overrides: a file in two globs gets the
 * last one, so a glob inside another comes after it.
 */
export const OWNERS: readonly string[] = [
  FILESYSTEM,
  EXECUTE,
  INPUT,
  MCP,
  STORE,
  PROCESS,
  STDIO,
];

/** A glob inside another owner's glob also gets what that one lifts. */
const WITHIN: Readonly<Record<string, readonly string[]>> = {
  [PROCESS]: [EXECUTE],
};

const PROCESS_OWNERS = [PROCESS, STDIO, INPUT];
const PROCESS_MESSAGE =
  'Só src/execute/process.ts toca no processo atual (argumentos, ambiente, sinais, saída); stdout/stderr são do src/output/stdio.ts e o stdin do src/input. Veja AGENTS.md.';

interface RestrictedImport {
  readonly owners: readonly string[];
  /** The module names, with and without `node:`. */
  readonly names: readonly string[];
  /** Subpaths (`node:path/*`), restricted as a group. */
  readonly patterns: readonly string[];
  /** What the lint says; `{name}` is the import's name. */
  readonly message: string;
}

const IMPORTS: readonly RestrictedImport[] = [
  {
    owners: [FILESYSTEM],
    names: ['node:fs', 'fs', 'node:fs/promises', 'fs/promises'],
    patterns: [],
    message:
      'Só src/filesystem importa {name}: o disco passa pelo src/filesystem. Veja AGENTS.md.',
  },
  {
    owners: [FILESYSTEM],
    names: ['node:path', 'path'],
    patterns: ['node:path/*', 'path/*'],
    message:
      'Só src/filesystem importa {name}: caminhos vêm do src/filesystem (join, resolve…). Veja AGENTS.md.',
  },
  {
    owners: [EXECUTE],
    names: ['node:child_process', 'child_process'],
    patterns: [],
    message:
      'Só src/execute importa {name}: programas rodam pelo src/execute (Executor, runProgram…). Veja AGENTS.md.',
  },
  {
    owners: [INPUT],
    names: ['node:readline', 'readline'],
    patterns: ['node:readline/*', 'readline/*'],
    message:
      'Só src/input importa {name}: o terminal é lido só pelo src/input. Veja AGENTS.md.',
  },
  {
    owners: PROCESS_OWNERS,
    names: ['node:process', 'process'],
    patterns: [],
    message: PROCESS_MESSAGE,
  },
  {
    owners: [MCP],
    names: ['@modelcontextprotocol/server'],
    patterns: [],
    message:
      'Só src/mcp importa o SDK do MCP: servidores MCP passam pelo src/mcp (serveTools). Veja AGENTS.md.',
  },
  {
    owners: [STORE],
    names: ['bun:sqlite'],
    patterns: [],
    message:
      'Só src/store importa bun:sqlite: o banco passa pelo src/store. Veja AGENTS.md.',
  },
  {
    owners: [],
    names: ['bun'],
    patterns: [],
    message:
      'O módulo bun dá disco e processos por fora dos donos: use o src/filesystem, o src/execute… Veja AGENTS.md.',
  },
];

interface RestrictedProperty {
  readonly owners: readonly string[];
  readonly object: string;
  readonly property: string;
  readonly message: string;
}

const RUNS_PROGRAMS =
  'Só src/execute roda programas: use o Executor, runProgram… Veja AGENTS.md.';

const PROPERTIES: readonly RestrictedProperty[] = [
  {
    owners: PROCESS_OWNERS,
    object: 'globalThis',
    property: 'process',
    message: PROCESS_MESSAGE,
  },
  {
    owners: [FILESYSTEM],
    object: 'Bun',
    property: 'write',
    message:
      'Só src/filesystem grava no disco: use writeText, writeBytes… Veja AGENTS.md.',
  },
  {
    owners: [FILESYSTEM],
    object: 'Bun',
    property: 'file',
    message:
      'Só src/filesystem lê o disco: use readText, readBytes… Veja AGENTS.md.',
  },
  {
    owners: [EXECUTE],
    object: 'Bun',
    property: 'spawn',
    message: RUNS_PROGRAMS,
  },
  {
    owners: [EXECUTE],
    object: 'Bun',
    property: 'spawnSync',
    message: RUNS_PROGRAMS,
  },
  { owners: [EXECUTE], object: 'Bun', property: '$', message: RUNS_PROGRAMS },
  {
    owners: [EXECUTE],
    object: 'Bun',
    property: 'build',
    message:
      'Só src/execute monta os auxiliares: use o bundleHelper. Veja AGENTS.md.',
  },
  {
    owners: [INPUT],
    object: 'Bun',
    property: 'stdin',
    message: 'Só src/input lê o stdin. Veja AGENTS.md.',
  },
  {
    owners: [STDIO],
    object: 'Bun',
    property: 'stdout',
    message: 'Só src/output/stdio.ts escreve no stdout. Veja AGENTS.md.',
  },
  {
    owners: [STDIO],
    object: 'Bun',
    property: 'stderr',
    message: 'Só src/output/stdio.ts escreve no stderr. Veja AGENTS.md.',
  },
];

const IMPORTS_RULE = 'eslint/no-restricted-imports';
const PROPERTIES_RULE = 'eslint/no-restricted-properties';

/** An override of `.oxlintrc.json`: the files and the rules it changes. */
export interface LintOverride {
  readonly files: readonly string[];
  readonly rules?: Readonly<Record<string, unknown>>;
}

/** The part of `.oxlintrc.json` the owner rules live in; the rest is kept. */
export interface LintConfig {
  readonly rules: Readonly<Record<string, unknown>>;
  readonly overrides?: readonly LintOverride[];
  readonly [key: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOverride = (value: unknown): value is LintOverride =>
  isRecord(value) &&
  Array.isArray(value['files']) &&
  value['files'].every((file) => typeof file === 'string') &&
  (value['rules'] === undefined || isRecord(value['rules']));

const isLintConfig = (value: unknown): value is LintConfig =>
  isRecord(value) &&
  isRecord(value['rules']) &&
  (value['overrides'] === undefined ||
    (Array.isArray(value['overrides']) &&
      value['overrides'].every(isOverride)));

/**
 * The text of `.oxlintrc.json` (from `where`) as a `LintConfig`. Not one (no
 * `rules`, an override without `files`) is a `UsageError`.
 */
export function readLintConfig(text: string, where: string): LintConfig {
  const value: unknown = JSON.parse(text);
  if (!isLintConfig(value)) {
    throw new UsageError(
      `${where} não tem a forma de um .oxlintrc.json: faltam as rules, ou um override não tem files.`,
    );
  }
  return value;
}

/** The globs whose restrictions `glob` lifts: its own and the ones it is inside. */
function lifted(glob: string): ReadonlySet<string> {
  return new Set([glob, ...(WITHIN[glob] ?? [])]);
}

const ownedBy = (
  owners: readonly string[],
  globs: ReadonlySet<string>,
): boolean => owners.some((owner) => globs.has(owner));

/** `no-restricted-imports`, without what `globs` own. */
function importsRule(globs: ReadonlySet<string>): readonly unknown[] {
  const kept = IMPORTS.filter(({ owners }) => !ownedBy(owners, globs));
  const paths = kept.flatMap(({ names, message }) =>
    names.map((name) => ({
      name,
      message: message.replaceAll('{name}', name),
    })),
  );
  const patterns = kept
    .filter(({ patterns: group }) => group.length > 0)
    .map(({ patterns: group, message }) => ({
      group,
      message: message.replaceAll('{name}', group[0] ?? ''),
    }));
  return ['error', patterns.length > 0 ? { paths, patterns } : { paths }];
}

/** `no-restricted-properties`, without what `globs` own. */
function propertiesRule(globs: ReadonlySet<string>): readonly unknown[] {
  return [
    'error',
    ...PROPERTIES.filter(({ owners }) => !ownedBy(owners, globs)).map(
      ({ object, property, message }) => ({ object, property, message }),
    ),
  ];
}

const isOwnerOverride = ({ files }: LintOverride): boolean =>
  files.length === 1 && OWNERS.includes(files[0] ?? '');

/**
 * `config` with its owner rules written from the table: the base restricts
 * everything, and one override per owner lifts what is its own. The other
 * overrides stay as they were; the owners' ones go where the first of them
 * was, or right after the first override (the tests') when there are none.
 */
export function withOwnerRules(config: LintConfig): LintConfig {
  const overrides = config.overrides ?? [];
  const first = overrides.findIndex(isOwnerOverride);
  const others = overrides.filter((override) => !isOwnerOverride(override));
  // Before the first owner override there are only others: it is the place.
  const at = first === -1 ? Math.min(1, others.length) : first;
  const owners: LintOverride[] = OWNERS.map((glob) => ({
    files: [glob],
    rules: {
      [IMPORTS_RULE]: importsRule(lifted(glob)),
      [PROPERTIES_RULE]: propertiesRule(lifted(glob)),
    },
  }));
  return {
    ...config,
    rules: {
      ...config.rules,
      [IMPORTS_RULE]: importsRule(new Set()),
      [PROPERTIES_RULE]: propertiesRule(new Set()),
    },
    overrides: [...others.slice(0, at), ...owners, ...others.slice(at)],
  };
}
