import { join } from 'node:path';

import { EVERY_COMMAND, type AgentPermissions, type PermissionPolicy, type RunPlace } from '@choliba/domain';

import { runToolPath, runToolShortcuts } from './run-tool-path';

export const DELETE = 'delete';

/** The run tools there are: `delete`, and the ones `permissions.allow.tools` may name. */
export type RunToolName = typeof DELETE | 'playwright-cli' | 'playwright-trace' | 'ask';

/** What a run tool is for and how it is called, after its path. */
export interface RunToolSpec {
  readonly purpose: string;
  readonly usage: string;
}

/**
 * Every run tool: the scripts choliba writes next to a run folder for the agent, and the only way the
 * agent reaches what they do. `delete` comes from `permissions.allow.delete`; the others from
 * `permissions.allow.tools`, which takes only these names (the schema checks it).
 */
export const RUN_TOOL_SPECS: Readonly<Record<RunToolName, RunToolSpec>> = {
  [DELETE]: {
    purpose: 'removes files and folders under the paths you may delete; it is the only way to delete',
    usage: '<path…>',
  },
  'playwright-cli': {
    purpose: 'the browser (playwright cli)',
    usage: '<command> [args]',
  },
  'playwright-trace': {
    purpose: 'reads the trace.zip of a failed test (playwright trace)',
    usage: '<command> [args]',
  },
  ask: {
    purpose:
      'asks the person running you a question and prints the answer; the only way to ask: a question written in your ' +
      'answer reaches nobody, the run ends with it. Only for a decision you cannot find out yourself, ' +
      'with the choices in --options when there are some (--multi when more than one may be chosen). The person may ' +
      'take minutes: run it with the longest timeout your shell allows. Exit 2 means no answer: go on with an ' +
      'assumption you state',
    usage: '"<question>" [--options a,b,c] [--multi]',
  },
};

/** A run tool this run has, where its script goes and what it may be called with. */
export interface ActiveRunTool {
  readonly name: RunToolName;
  readonly path: string;
  /** The subcommands it may run; `undefined` is any. */
  readonly allowed: readonly string[] | undefined;
  readonly denied: readonly string[];
}

function subcommandsOf(rules: AgentPermissions['denyTools'], tool: string): readonly string[] {
  return rules.filter((rule) => rule.tool === tool).flatMap((rule) => rule.subcommands);
}

export function isRunToolName(name: string): name is RunToolName {
  return name in RUN_TOOL_SPECS;
}

function declaredTool(permissions: AgentPermissions, runDir: string, tool: RunToolName): ActiveRunTool | undefined {
  const allowed = subcommandsOf(permissions.allowTools, tool);
  const denied = subcommandsOf(permissions.denyTools, tool);
  if (denied.includes(EVERY_COMMAND)) {
    return undefined;
  }
  return {
    name: tool,
    path: runToolPath(runDir, tool),
    allowed: allowed.includes(EVERY_COMMAND) ? undefined : allowed,
    denied,
  };
}

/**
 * The run tools of a run: `delete` when `allow.delete` lists a path and the run may change files, plus every
 * tool `allow.tools` names, unless `deny.tools` takes all of it (`['*']`).
 */
export function activeRunTools(
  permissions: AgentPermissions,
  runDir: string,
  policy: PermissionPolicy,
): readonly ActiveRunTool[] {
  const deletes: readonly ActiveRunTool[] =
    permissions.allowDelete.length > 0 && policy !== 'read-only'
      ? [{ name: DELETE, path: runToolPath(runDir, DELETE), allowed: undefined, denied: [] }]
      : [];
  const declared = [...new Set(permissions.allowTools.map((rule) => rule.tool))]
    .filter(isRunToolName)
    .map((tool) => declaredTool(permissions, runDir, tool))
    .filter((tool) => tool !== undefined);
  return [...deletes, ...declared];
}

/** What the provider enforces for the run tools: the command prefixes allowed and denied, and the scripts nobody may write. */
export interface RunToolCommands {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
  readonly scripts: readonly string[];
}

/** The shortcut of `tool`: the file named after it in the shortcuts folder of its run (`<run>.bin/ask`). */
export function shortcutPath(tool: ActiveRunTool): string {
  const runDir = tool.path.slice(0, -(tool.name.length + 1));
  return join(runToolShortcuts(runDir), tool.name);
}

/** The commands `tool` is run with: its full path and, through its shortcut, its name alone. */
function commandsOf(tool: ActiveRunTool): readonly string[] {
  return [tool.path, tool.name];
}

export function runToolCommands(tools: readonly ActiveRunTool[]): RunToolCommands {
  return {
    allow: tools.flatMap((tool) =>
      commandsOf(tool).flatMap((command) => tool.allowed?.map((sub) => `${command} ${sub}`) ?? [command]),
    ),
    deny: tools.flatMap((tool) => commandsOf(tool).flatMap((command) => tool.denied.map((sub) => `${command} ${sub}`))),
    scripts: tools.flatMap((tool) => [tool.path, shortcutPath(tool)]),
  };
}

function scope(tool: ActiveRunTool): string {
  const only = tool.allowed === undefined ? [] : [`only: ${tool.allowed.join(', ')}`];
  const not = tool.denied.length === 0 ? [] : [`not: ${tool.denied.join(', ')}`];
  return [...only, ...not].map((part) => ` (${part})`).join('');
}

function toolLine(tool: ActiveRunTool): string {
  const spec = RUN_TOOL_SPECS[tool.name];
  return `- \`${tool.path} ${spec.usage}\`: ${spec.purpose}${scope(tool)}`;
}

/**
 * The run tools in words, for `formatPermissions`: each one's full path, how it is called and what for. Empty
 * without a run place, since the paths are only known there.
 */
export function runToolLines(permissions: AgentPermissions, place?: RunPlace): readonly string[] {
  if (place === undefined) {
    return [];
  }
  const tools = activeRunTools(permissions, place.runDir, place.policy ?? 'edits');
  if (tools.length === 0) {
    return [];
  }
  return [
    'Tools: run each by its full path, exactly as shown, from where you are (never cd); nothing else does what they do:',
    ...tools.map(toolLine),
  ];
}
