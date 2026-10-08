import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { isValidAgentName, loadAgent, mcpConfig, skillDescription } from '@choliba/agents';

import { fetchSource, type FetchedSource, type SourceDeps } from './install-source';
import { AGENTS_SUBDIR, AGENT_FILE, CHOLIBA_DIR, MCPS_SUBDIR, SKILLS_SUBDIR, SKILL_FILE } from '@choliba/core';

/** What `choliba install` installs, named as the report shows it. */
export type ItemKind = 'agente' | 'skill' | 'MCP';

/** One item found in the source, and where it is there. */
export interface PlannedItem {
  readonly kind: ItemKind;
  readonly name: string;
  readonly from: string;
}

export interface InstalledItem extends PlannedItem {
  readonly to: string;
}

/** Where each kind of item goes in the workspace (`resolveAgentsDir`, `resolveSkillsDir`, `resolveMcpsDir`). */
export interface InstallTargets {
  readonly agentsDir: string;
  readonly skillsDir: string;
  readonly mcpsDir: string;
}

export interface InstallArgs {
  readonly spec: string;
  readonly path?: string;
  readonly dryRun: boolean;
}

export interface InstallDeps {
  readonly workspaceRoot: string;
  readonly targets: InstallTargets;
  /** The workspace config: an MCP's `${NAME}` with no value here is reported. */
  readonly config: Readonly<Record<string, string | undefined>>;
  readonly source: SourceDeps;
  readonly fetch?: (spec: string, deps: SourceDeps) => FetchedSource;
}

export class InstallError extends Error {}

const USAGE = 'Uso: choliba install <origem> [--path <caminho na origem>] [--dry-run]';

/** `--path=x`, or `--path x` (the value taken from `queue`). */
function pathValue(arg: string, queue: string[]): string {
  if (arg.startsWith('--path=')) return arg.slice('--path='.length);
  const value = queue.shift();
  if (value === undefined || value.startsWith('-')) throw new InstallError(`--path precisa de um valor. ${USAGE}`);
  return value;
}

export function parseInstallArgs(argv: readonly string[]): InstallArgs {
  const specs: string[] = [];
  let path: string | undefined;
  let dryRun = false;
  const queue = [...argv];
  let arg: string | undefined;
  while ((arg = queue.shift()) !== undefined) {
    if (arg === '--path' || arg.startsWith('--path=')) {
      path = pathValue(arg, queue);
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('-')) {
      throw new InstallError(`opção desconhecida: ${arg}. ${USAGE}`);
    } else {
      specs.push(arg);
    }
  }
  const [spec] = specs;
  if (spec === undefined) throw new InstallError(USAGE);
  if (specs.length > 1) throw new InstallError(`instale uma origem só por vez (recebi ${specs.join(', ')}). ${USAGE}`);
  return { spec, ...(path === undefined ? {} : { path }), dryRun };
}

function isDir(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

/** The item `target` is, by what it holds: `agent.yaml`, `SKILL.md` or a `.json` file. */
function itemAt(target: string): PlannedItem | undefined {
  if (isDir(target) && existsSync(join(target, AGENT_FILE)))
    return { kind: 'agente', name: basename(target), from: target };
  if (isDir(target) && existsSync(join(target, SKILL_FILE)))
    return { kind: 'skill', name: basename(target), from: target };
  if (target.endsWith('.json') && existsSync(target))
    return { kind: 'MCP', name: basename(target, '.json'), from: target };
  return undefined;
}

/**
 * The items under `root`, relative to it, for `--path`: laid out like a workspace (`.choliba/agents`,
 * `.choliba/skills`, `.choliba/mcps`, as the choliba repo is) and at the root itself (`agents`, `skills`, `mcps`).
 */
function itemsUnder(root: string): readonly string[] {
  const entries = (dir: string, keep: (dir: string, name: string) => boolean): readonly string[] =>
    isDir(join(root, dir))
      ? readdirSync(join(root, dir))
          .filter((name) => keep(dir, name))
          .sort()
          .map((name) => `${dir}/${name}`)
      : [];
  return [CHOLIBA_DIR, ''].flatMap((base) => [
    ...entries(join(base, AGENTS_SUBDIR), (dir, name) => existsSync(join(root, dir, name, AGENT_FILE))),
    ...entries(join(base, SKILLS_SUBDIR), (dir, name) => existsSync(join(root, dir, name, SKILL_FILE))),
    ...entries(join(base, MCPS_SUBDIR), (_dir, name) => name.endsWith('.json')),
  ]);
}

/** Why `target` cannot be installed, naming it as the user wrote it (`shownAs`), not as a scratch folder. */
function notAnItem(target: string, shownAs: string): InstallError {
  const found = itemsUnder(target);
  if (found.length === 0) {
    return new InstallError(`${shownAs}: nenhum item no formato do choliba (${AGENT_FILE}, ${SKILL_FILE} ou .json).`);
  }
  return new InstallError(
    [
      `${shownAs} não é um agente (${AGENT_FILE}), uma skill (${SKILL_FILE}) nem um MCP (.json). Escolha um com --path:`,
      ...found.map((path) => `  ${path}`),
    ].join('\n'),
  );
}

/** Checks `item` as a run would load it; throws naming the file. */
function checkItem(item: PlannedItem): void {
  if (!isValidAgentName(item.name)) {
    throw new InstallError(`${item.from}: nome inválido "${item.name}" (letras minúsculas, dígitos, "-" e "_").`);
  }
  if (item.kind === 'agente') {
    loadAgent(dirname(item.from), item.name);
  } else if (item.kind === 'skill') {
    const file = join(item.from, SKILL_FILE);
    skillDescription(readFileSync(file, 'utf8'), file);
  } else {
    mcpConfig(readFileSync(item.from, 'utf8'), item.from);
  }
}

/** `relativePath` in the nearest folder that has it, from `start` up to `searchUpTo` (inclusive). */
function findUpTo(start: string, searchUpTo: string, relativePath: string): string | undefined {
  for (let dir = start; ; dir = dirname(dir)) {
    const candidate = join(dir, relativePath);
    if (existsSync(candidate)) return candidate;
    if (dir === searchUpTo || dir === dirname(dir)) return undefined;
  }
}

/** The skills and MCPs an agent declares, found in its source; the ones missing become warnings. */
function dependencies(
  agentDir: string,
  searchUpTo: string,
): { items: readonly PlannedItem[]; warnings: readonly string[] } {
  const agent = loadAgent(dirname(agentDir), basename(agentDir));
  const wanted: readonly (readonly [ItemKind, string, string])[] = [
    ...agent.skills.map((skill) => ['skill', skill.name, join(SKILLS_SUBDIR, skill.name)] as const),
    ...agent.mcps.map((mcp) => ['MCP', mcp.name, join(MCPS_SUBDIR, `${mcp.name}.json`)] as const),
  ];
  const items: PlannedItem[] = [];
  const warnings: string[] = [];
  for (const [kind, name, relativePath] of wanted) {
    const from = findUpTo(dirname(agentDir), searchUpTo, relativePath);
    if (from === undefined) {
      const article = kind === 'skill' ? 'a skill' : 'o MCP';
      warnings.push(`${article} "${name}", que o agente ${agent.name} declara, não está na origem: instale à parte.`);
      continue;
    }
    items.push({ kind, name, from });
  }
  return { items, warnings };
}

/**
 * What installing `target` means: the item there (an agent comes with the skills and MCPs it declares
 * that the source has, looked for up to `searchUpTo`), every one checked. Nothing is written.
 */
export function planInstall(
  target: string,
  searchUpTo: string,
  shownAs: string = target,
): { items: readonly PlannedItem[]; warnings: readonly string[] } {
  const item = itemAt(target);
  if (item === undefined) throw notAnItem(target, shownAs);
  checkItem(item);
  if (item.kind !== 'agente') return { items: [item], warnings: [] };
  const deps = dependencies(item.from, searchUpTo);
  for (const dependency of deps.items) {
    checkItem(dependency);
  }
  return { items: [item, ...deps.items], warnings: deps.warnings };
}

function destination(item: PlannedItem, targets: InstallTargets): string {
  if (item.kind === 'agente') return join(targets.agentsDir, item.name);
  if (item.kind === 'skill') return join(targets.skillsDir, item.name);
  return join(targets.mcpsDir, `${item.name}.json`);
}

/** Copies each item to the workspace, replacing what was there (a file the source dropped does not stay). */
function copyItems(items: readonly PlannedItem[], targets: InstallTargets, dryRun: boolean): readonly InstalledItem[] {
  return items.map((item) => {
    const to = destination(item, targets);
    if (!dryRun) {
      rmSync(to, { recursive: true, force: true });
      mkdirSync(dirname(to), { recursive: true });
      cpSync(item.from, to, { recursive: true });
    }
    return { ...item, to };
  });
}

const VARIABLE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

/** For each MCP, the `${NAME}` its JSON uses that the workspace config has no value for. */
function missingVariables(
  items: readonly PlannedItem[],
  config: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return items
    .filter((item) => item.kind === 'MCP')
    .flatMap((item) => {
      const names: string[] = [];
      readFileSync(item.from, 'utf8').replaceAll(VARIABLE, (whole: string, name: string) => {
        names.push(name);
        return whole;
      });
      const missing = [...new Set(names)].filter((name) => config[name] === undefined);
      return missing.length === 0
        ? []
        : [
            `o MCP ${item.name} usa ${missing.map((name) => `\${${name}}`).join(', ')}, sem valor no .env: defina antes de rodar o agente.`,
          ];
    });
}

export function formatInstall(
  workspaceRoot: string,
  installed: readonly InstalledItem[],
  warnings: readonly string[],
  dryRun: boolean,
): string {
  return [
    dryRun ? 'Instalaria (--dry-run, nada foi gravado):' : 'Instalado:',
    ...installed.map((item) => `  ${item.kind} ${item.name} → ${relative(workspaceRoot, item.to)}`),
    ...(warnings.length === 0 ? [] : ['', 'Avisos:', ...warnings.map((warning) => `  - ${warning}`)]),
    '',
    'Confira com: choliba check',
  ].join('\n');
}

/** `choliba install`: fetches the source, plans, copies and reports; the fetched source is always cleaned up. */
export function install(args: InstallArgs, deps: InstallDeps): string {
  const fetched = (deps.fetch ?? fetchSource)(args.spec, deps.source);
  try {
    const target = args.path === undefined ? fetched.root : join(fetched.root, args.path);
    const shownAs = args.path === undefined ? args.spec : `${args.spec} --path ${args.path}`;
    const plan = planInstall(target, fetched.searchUpTo, shownAs);
    const installed = copyItems(plan.items, deps.targets, args.dryRun);
    return formatInstall(
      deps.workspaceRoot,
      installed,
      [...plan.warnings, ...missingVariables(plan.items, deps.config)],
      args.dryRun,
    );
  } finally {
    fetched.cleanup();
  }
}
