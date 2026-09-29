import { dirname, isAbsolute, join } from 'node:path';

import { asStringArray, isRecord } from './json';

/** One entry of `permissions.allow.execute`/`.deny.execute`: a directory and the commands that go with it. */
export interface ExecuteRule {
  readonly dir: string;
  /** Command prefixes (`git diff` covers `git diff ...`); `['*']` in a deny rule is every command. */
  readonly commands: readonly string[];
}

/** The only command a deny rule may list alone: nothing runs in that directory. */
export const EVERY_COMMAND = '*';

/**
 * What an agent's `agent.yaml#permissions` declares, read so the providers can enforce it instead of
 * only asking the model to follow it. Paths are as written (absolute, relative to the workspace root
 * or with `${VAR}` until `vars.ts` expands them). Anything not allowed is denied.
 */
export interface AgentPermissions {
  readonly allowRead: readonly string[];
  readonly allowWrite: readonly string[];
  readonly allowExecute: readonly ExecuteRule[];
  readonly denyRead: readonly string[];
  readonly denyWrite: readonly string[];
  readonly denyExecute: readonly ExecuteRule[];
}

export const NO_PERMISSIONS: AgentPermissions = {
  allowRead: [],
  allowWrite: [],
  allowExecute: [],
  denyRead: [],
  denyWrite: [],
  denyExecute: [],
};

function group(permissions: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = permissions[key];
  return isRecord(value) ? value : {};
}

function paths(from: Record<string, unknown>, key: string): readonly string[] {
  return asStringArray(from[key]) ?? [];
}

function rules(from: Record<string, unknown>, key: string): readonly ExecuteRule[] {
  const value = from[key];
  if (!isRecord(value)) {
    return [];
  }
  return Object.entries(value).map(([dir, commands]) => ({ dir, commands: asStringArray(commands) ?? [] }));
}

/** Reads `agent.yaml#permissions` (already checked against the schema); none declared is `NO_PERMISSIONS`. */
export function readAgentPermissions(value: unknown): AgentPermissions {
  if (!isRecord(value)) {
    return NO_PERMISSIONS;
  }
  const allow = group(value, 'allow');
  const deny = group(value, 'deny');
  return {
    allowRead: paths(allow, 'read'),
    allowWrite: paths(allow, 'write'),
    allowExecute: rules(allow, 'execute'),
    denyRead: paths(deny, 'read'),
    denyWrite: paths(deny, 'write'),
    denyExecute: rules(deny, 'execute'),
  };
}

/** `permissions` with `change` applied to every path, directory and command in it. */
export function mapPermissions(permissions: AgentPermissions, change: (text: string) => string): AgentPermissions {
  const list = (items: readonly string[]): readonly string[] => items.map(change);
  const ruleList = (items: readonly ExecuteRule[]): readonly ExecuteRule[] =>
    items.map((rule) => ({ dir: change(rule.dir), commands: list(rule.commands) }));
  return {
    allowRead: list(permissions.allowRead),
    allowWrite: list(permissions.allowWrite),
    allowExecute: ruleList(permissions.allowExecute),
    denyRead: list(permissions.denyRead),
    denyWrite: list(permissions.denyWrite),
    denyExecute: ruleList(permissions.denyExecute),
  };
}

/** Every path, directory and command in `permissions`, e.g. to look for `${VAR}` in them. */
export function permissionTexts(permissions: AgentPermissions): readonly string[] {
  const ruleTexts = (items: readonly ExecuteRule[]): readonly string[] =>
    items.flatMap((rule) => [rule.dir, ...rule.commands]);
  return [
    ...permissions.allowRead,
    ...permissions.allowWrite,
    ...ruleTexts(permissions.allowExecute),
    ...permissions.denyRead,
    ...permissions.denyWrite,
    ...ruleTexts(permissions.denyExecute),
  ];
}

/** The commands the agent may run, wherever. */
export function allowedCommands(permissions: AgentPermissions): readonly string[] {
  return [...new Set(permissions.allowExecute.flatMap((rule) => rule.commands))];
}

/** A deny rule's commands: the ones blocked, or none when it blocks every command (`['*']`). */
export function blocksEveryCommand(rule: ExecuteRule): boolean {
  return rule.commands.includes(EVERY_COMMAND);
}

/** A directory as written in `execute` (`/x/` or `/x`), without the trailing `/`. */
export function withoutTrailingSlash(dir: string): string {
  return dir.length > 1 && dir.endsWith('/') ? dir.slice(0, -1) : dir;
}

/** `path` as an absolute path: a relative one is relative to the workspace root. */
function absolute(path: string, root: string): string {
  return isAbsolute(path) ? path : join(root, path);
}

/**
 * `permissions` with every path and directory absolute (commands untouched): the provider does not run in
 * the workspace root, so a relative path would be read from the wrong place.
 */
export function absolutePermissions(permissions: AgentPermissions, root: string): AgentPermissions {
  const paths = (items: readonly string[]): readonly string[] => items.map((path) => absolute(path, root));
  const rules = (items: readonly ExecuteRule[]): readonly ExecuteRule[] =>
    items.map((rule) => ({ dir: absolute(rule.dir, root), commands: rule.commands }));
  return {
    allowRead: paths(permissions.allowRead),
    allowWrite: paths(permissions.allowWrite),
    allowExecute: rules(permissions.allowExecute),
    denyRead: paths(permissions.denyRead),
    denyWrite: paths(permissions.denyWrite),
    denyExecute: rules(permissions.denyExecute),
  };
}

/** The directory a declared path lives under: the part before the first glob segment, or its folder. */
export function pathBase(path: string): string {
  const segments = path.split('/');
  const globAt = segments.findIndex((segment) => /[*?[\]]/.test(segment));
  if (globAt !== -1) {
    return segments.slice(0, globAt).join('/') || '/';
  }
  return path.endsWith('/') ? path.slice(0, -1) || '/' : dirname(path);
}

/** The directories `execute` names (absolute) other than the workspace root, where commands run anyway. */
export function outsideExecuteDirs(permissions: AgentPermissions, root: string): readonly string[] {
  const dirs = permissions.allowExecute.map((rule) => withoutTrailingSlash(rule.dir));
  return [...new Set(dirs)].filter((dir) => dir !== withoutTrailingSlash(root));
}

/** Whether `dir` is inside a folder `allow.read` names (a path ending in `/`). */
export function canRead(permissions: AgentPermissions, dir: string): boolean {
  return permissions.allowRead.some(
    (path) => path.endsWith('/') && (dir === withoutTrailingSlash(path) || dir.startsWith(path)),
  );
}

/** A declared path as a glob: `docs/` covers everything under it, anything else stays as written. */
export function pathGlob(path: string): string {
  return path.endsWith('/') ? `${path}**` : path;
}

function pathLines(label: string, items: readonly string[]): readonly string[] {
  return items.length === 0 ? [] : [`${label}:`, ...items.map((item) => `- ${item}`)];
}

function ruleLines(label: string, items: readonly ExecuteRule[]): readonly string[] {
  const describe = (rule: ExecuteRule): string =>
    `- in ${rule.dir}: ${blocksEveryCommand(rule) ? 'every command' : rule.commands.join(', ')}`;
  return items.length === 0 ? [] : [`${label}:`, ...items.map(describe)];
}

/**
 * The permissions in words, for the prompt: the model reads what it may do from the same data the
 * provider enforces, so the two never disagree.
 */
/** Where a run happens: the empty folder the provider runs in, inside the workspace root. */
export interface RunPlace {
  readonly runDir: string;
  readonly root: string;
}

export function formatPermissions(permissions: AgentPermissions, place?: RunPlace): string {
  const lines = [
    ...pathLines('You may read', permissions.allowRead),
    ...pathLines('You may write', permissions.allowWrite),
    ...ruleLines('You may run', permissions.allowExecute),
    ...pathLines('You may not read', permissions.denyRead),
    ...pathLines('You may not write', permissions.denyWrite),
    ...ruleLines('You may not run', permissions.denyExecute),
  ];
  const commands =
    permissions.allowExecute.length === 0
      ? []
      : [
          place === undefined
            ? 'Run each command exactly as listed, from where you are (a folder inside the workspace, where it works as is):'
            : `You run in ${place.runDir}, an empty folder inside the workspace ${place.root}. Run each command exactly as listed, from there: it finds the workspace by itself. Never cd, not even to ${place.root} (it is refused):`,
          'chaining listed commands with && works, but any other part (cd, a pipe, a redirection, another program) gets the whole command refused.',
        ];
  const body =
    lines.length === 0
      ? ['Nothing is allowed: you may not read, write or run anything yourself; work with what this prompt gives you.']
      : [...lines, ...commands];
  return [
    '<permissions>',
    'Enforced by the command, not only asked: anything not allowed below is blocked. Relative paths are relative to the workspace root; paths ending in / cover everything under them.',
    ...body,
    '</permissions>',
  ].join('\n');
}
