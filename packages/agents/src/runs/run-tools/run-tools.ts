import { chmodSync, rmSync, writeFileSync } from 'node:fs';

import { CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR } from '@choliba/core/config';

import type { PermissionPolicy } from '../../agents/interfaces/command.interface';
import type { PlannedFile, ProviderRequest } from '../../providers/interfaces/provider.interface';
import { type AgentPermissions, absolutePermissions, EVERY_COMMAND, type RunPlace } from '../permissions';
import { deleteScript } from './delete.tool';
import { DEFAULT_PLAYWRIGHT_OUTPUT_DIR, playwrightScript } from './playwright.tool';
import { runToolPath } from './run-tool-path';

/** What a run tool's script is written from. */
interface ScriptContext {
  /** Already absolute (`absolutePermissions`). */
  readonly permissions: AgentPermissions;
  readonly workspaceRoot: string;
  readonly config: Readonly<Record<string, string | undefined>>;
}

interface RunToolSpec {
  /** What the prompt says it is for. */
  readonly purpose: string;
  /** How it is called, after its path. */
  readonly usage: string;
  readonly script: (context: ScriptContext) => string;
}

const DELETE = 'delete';

/** The run tools there are: `delete`, and the ones `permissions.allow.tools` may name. */
type RunToolName = typeof DELETE | 'playwright-cli' | 'playwright-trace';

/**
 * Every run tool: the scripts choliba writes next to a run folder for the agent, and the only way the
 * agent reaches what they do. `delete` comes from `permissions.allow.delete`; the others from
 * `permissions.allow.tools`, which takes only these names (the schema checks it).
 */
const RUN_TOOLS: Readonly<Record<RunToolName, RunToolSpec>> = {
  [DELETE]: {
    purpose: 'removes files and folders under the paths you may delete; it is the only way to delete',
    usage: '<path…>',
    script: ({ permissions }) => deleteScript(permissions.allowDelete, permissions.denyDelete),
  },
  'playwright-cli': {
    purpose: 'the browser (playwright cli)',
    usage: '<command> [args]',
    script: ({ workspaceRoot, config }) =>
      playwrightScript({
        command: 'cli',
        workspaceRoot,
        outputDir: config[CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR] ?? DEFAULT_PLAYWRIGHT_OUTPUT_DIR,
      }),
  },
  'playwright-trace': {
    purpose: 'reads the trace.zip of a failed test (playwright trace)',
    usage: '<command> [args]',
    script: ({ workspaceRoot }) => playwrightScript({ command: 'trace', workspaceRoot }),
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

function isRunToolName(name: string): name is RunToolName {
  return name in RUN_TOOLS;
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

/** The run tools of what a provider runs. */
export function runToolsOf(request: ProviderRequest): readonly ActiveRunTool[] {
  return activeRunTools(request.agent.permissions, request.runDir, request.policy);
}

/** What the provider enforces for the run tools: the command prefixes allowed and denied, and the scripts nobody may write. */
export interface RunToolCommands {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
  readonly scripts: readonly string[];
}

export function runToolCommands(tools: readonly ActiveRunTool[]): RunToolCommands {
  return {
    allow: tools.flatMap((tool) => tool.allowed?.map((sub) => `${tool.path} ${sub}`) ?? [tool.path]),
    deny: tools.flatMap((tool) => tool.denied.map((sub) => `${tool.path} ${sub}`)),
    scripts: tools.map((tool) => tool.path),
  };
}

/** The scripts of the run tools of `request`, writing nothing (`--dry-run --show-prompt` shows them). */
export function planRunTools(
  request: ProviderRequest,
  config: Readonly<Record<string, string | undefined>>,
): readonly PlannedFile[] {
  const context: ScriptContext = {
    permissions: absolutePermissions(request.agent.permissions, request.workspaceRoot),
    workspaceRoot: request.workspaceRoot,
    config,
  };
  return runToolsOf(request).map((tool) => ({ path: tool.path, content: RUN_TOOLS[tool.name].script(context) }));
}

/** Writes `files` as executables and returns the restore that removes them, safe to call more than once. */
export function applyRunTools(files: readonly PlannedFile[]): () => void {
  for (const file of files) {
    writeFileSync(file.path, file.content, 'utf8');
    chmodSync(file.path, 0o755);
  }
  let restored = false;
  return () => {
    if (restored) {
      return;
    }
    restored = true;
    for (const file of files) {
      rmSync(file.path, { force: true });
    }
  };
}

function scope(tool: ActiveRunTool): string {
  const only = tool.allowed === undefined ? [] : [`only: ${tool.allowed.join(', ')}`];
  const not = tool.denied.length === 0 ? [] : [`not: ${tool.denied.join(', ')}`];
  return [...only, ...not].map((part) => ` (${part})`).join('');
}

function toolLine(tool: ActiveRunTool): string {
  const spec = RUN_TOOLS[tool.name];
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
