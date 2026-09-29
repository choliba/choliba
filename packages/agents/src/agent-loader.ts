import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type { AgentDefinition, AgentStep, McpDeclaration } from './agent.types';
import type { ExecutionMode, PermissionPolicy } from './command.types';
import { validateAgentYamlV1, validateSystemMd } from './agent-validation';
import { type AgentPermissions, readAgentPermissions } from './permissions';
import { checkStep, type StepPhase } from './prepare/actions';
import { AGENT_FILE, SYSTEM_FILE } from '@choliba/core/config';

export class AgentConfigError extends Error {}

/**
 * Blocks path traversal (`..`, `/`) and anything that would not be a plain directory name.
 * Every agent name — user-supplied on the CLI — is checked against this before it ever
 * touches the filesystem.
 */
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** The modes of `modes.allow`: never empty (the schema asks for at least one). */
type Modes = readonly [ExecutionMode, ...ExecutionMode[]];

const ALL_MODES: Modes = ['execute', 'plan', 'ask'];

/** The variables that only have a value when the run has a project (and, for the ticket ones, a ticket). */
const PROJECT_VAR = /\$\{(PROJECT|PROJECT_DIR|APP_DIR|TICKET|TICKET_FILE)\}/;

export function isValidAgentName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

/** What `agent.yaml` alone says; `loadAgent` adds what needs `system.md` too. */
type YamlFields = Omit<AgentDefinition, 'name' | 'dir' | 'systemPromptPath' | 'instructions' | 'projectRequired'>;

/** `edits` when the agent may write somewhere, `read-only` otherwise. */
export function policyFromPermissions(permissions: AgentPermissions): PermissionPolicy {
  return permissions.allowWrite.length > 0 ? 'edits' : 'read-only';
}

/**
 * An `agent.yaml` of standard 1 after `validateAgentYamlV1`: the schema already guarantees this shape,
 * so it is read as it is, without checking each field again.
 */
interface AgentYamlV1 {
  readonly agent: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly description: string;
  };
  readonly models: readonly string[];
  readonly skills?: readonly string[];
  readonly mcps?: McpList | McpMap;
  readonly permissions?: unknown;
  readonly modes?: { readonly allow?: Modes; readonly default?: ExecutionMode };
  readonly task?: { readonly required?: boolean; readonly default?: string };
  readonly ticket_types?: readonly string[];
  readonly steps?: {
    readonly before?: readonly Readonly<Record<string, readonly string[]>>[];
    readonly after?: readonly Readonly<Record<string, readonly string[]>>[];
  };
}

/** `modes.allow` (all three when absent) and `modes.default` (`execute` when allowed, else the first allowed). */
function parseModes(modes: AgentYamlV1['modes']): { modes: readonly ExecutionMode[]; defaultMode: ExecutionMode } {
  const allowed = modes?.allow ?? ALL_MODES;
  const fallback = allowed.includes('execute') ? 'execute' : allowed[0];
  return { modes: allowed, defaultMode: modes?.default ?? fallback };
}

/** Each step, `<action>: [args]`, checked against the action's own rules (e.g. `git_diff`'s arguments). */
function parseSteps(
  steps: readonly Readonly<Record<string, readonly string[]>>[] | undefined,
  phase: StepPhase,
  fail: (reason: string) => never,
): readonly AgentStep[] | undefined {
  return steps?.flatMap((line) =>
    Object.entries(line).map(([action, args]) => {
      const checked = checkStep({ action, args }, phase);
      return 'error' in checked ? fail(`"steps": ${checked.error}`) : { action, args };
    }),
  );
}

type McpList = readonly string[];
type McpMap = Readonly<Record<string, { readonly tools: readonly string[] } | null>>;

/** `Array.isArray` does not narrow a readonly array out of a union; this does. */
function isMcpList(mcps: McpList | McpMap): mcps is McpList {
  return Array.isArray(mcps);
}

/** `mcps` as a list of server names (every tool of each) or a map of server name to `{ tools }` or null. */
function parseMcps(mcps: McpList | McpMap | undefined): readonly McpDeclaration[] {
  if (mcps === undefined) {
    return [];
  }
  if (isMcpList(mcps)) {
    return mcps.map((name) => ({ name }));
  }
  return Object.entries(mcps).map(([name, entry]) => (entry === null ? { name } : { name, tools: entry.tools }));
}

/**
 * Parses one `agent.yaml` of standard 1, in the folder `folder`. The file is checked by
 * `validateAgentYamlV1` first (version, schema, `agent.id` = folder), so what is read below already
 * has the right shape; a problem throws `AgentConfigError` naming `source` and every error found.
 */
export function parseAgentYaml(text: string, source: string, folder: string): YamlFields {
  const fail = (reason: string): never => {
    throw new AgentConfigError(`${source}: ${reason}`);
  };
  const validation = validateAgentYamlV1(text, folder);
  if (!validation.valid) {
    return fail(validation.errors.join('\n'));
  }
  const doc = parseYaml(text) as AgentYamlV1;
  const permissions = readAgentPermissions(doc.permissions);
  const beforeExecute = parseSteps(doc.steps?.before, 'before_execute', fail);
  const afterExecute = parseSteps(doc.steps?.after, 'after_execute', fail);
  return {
    id: doc.agent.id,
    displayName: doc.agent.name,
    version: doc.agent.version,
    description: doc.agent.description,
    supportedModels: doc.models,
    skills: doc.skills ?? [],
    mcps: parseMcps(doc.mcps),
    permissions,
    policy: policyFromPermissions(permissions),
    taskRequired: doc.task?.required ?? true,
    ...(doc.ticket_types === undefined ? {} : { ticketTypes: doc.ticket_types }),
    ...parseModes(doc.modes),
    ...(doc.task?.default === undefined ? {} : { defaultTask: doc.task.default }),
    ...(beforeExecute === undefined ? {} : { beforeExecute }),
    ...(afterExecute === undefined ? {} : { afterExecute }),
  };
}

/** Whether a run needs `--project`: the agent uses a project variable anywhere, or works on tickets. */
function needsProject(yamlText: string, instructions: string, fields: YamlFields): boolean {
  return fields.ticketTypes !== undefined || PROJECT_VAR.test(yamlText) || PROJECT_VAR.test(instructions);
}

/**
 * Loads one agent from `<agentsDir>/<name>/agent.yaml` + `system.md` — and validates both for
 * real before handing back an `AgentDefinition`: `agent.yaml` against the standard it declares
 * (`validateAgentYamlV1`), `system.md` against `agent.xsd`. A violation in either file throws
 * `AgentConfigError` naming every problem found — this is the one place every caller (the CLI,
 * `listAgents`, tests) goes through, so nothing downstream ever sees an agent that fails its schema.
 */
export async function loadAgent(agentsDir: string, name: string): Promise<AgentDefinition> {
  if (!isValidAgentName(name)) {
    throw new AgentConfigError(`invalid agent name "${name}" (expected lowercase, digits, "-", "_")`);
  }

  const dir = join(agentsDir, name);
  const yamlPath = join(dir, AGENT_FILE);
  const systemPromptPath = join(dir, SYSTEM_FILE);

  let yamlText: string;
  try {
    yamlText = readFileSync(yamlPath, 'utf8');
  } catch {
    throw new AgentConfigError(`agent "${name}" not found: ${yamlPath} does not exist`);
  }
  const fields = parseAgentYaml(yamlText, yamlPath, name);

  let instructions: string;
  try {
    instructions = readFileSync(systemPromptPath, 'utf8');
  } catch {
    throw new AgentConfigError(`agent "${name}" is missing ${systemPromptPath}`);
  }
  const validation = await validateSystemMd(instructions);
  if (!validation.valid) {
    const errors = validation.errors.map((error) => `${systemPromptPath}: ${error}`);
    throw new AgentConfigError(`agent "${name}" failed schema validation:\n${errors.join('\n')}`);
  }

  return {
    name,
    dir,
    systemPromptPath,
    instructions,
    ...fields,
    projectRequired: needsProject(yamlText, instructions, fields),
  };
}

/**
 * Lists every agent in `agentsDir`: each subdirectory that has an `agent.yaml`. A directory
 * starting with `_` is skipped without needing an `agent.yaml` check first.
 */
export async function listAgents(agentsDir: string): Promise<readonly AgentDefinition[]> {
  let entries: readonly string[];
  try {
    entries = readdirSync(agentsDir);
  } catch {
    return [];
  }

  const agents: AgentDefinition[] = [];
  for (const entry of entries.toSorted()) {
    if (entry.startsWith('_') || !isValidAgentName(entry)) {
      continue;
    }
    const dir = join(agentsDir, entry);
    if (!statSync(dir).isDirectory()) {
      continue;
    }
    try {
      agents.push(await loadAgent(agentsDir, entry));
    } catch {
      // Not every directory here need be a well-formed agent (or an agent at all); listAgents
      // surfaces the ones that load, loadAgent is where a specific failure is reported.
      continue;
    }
  }
  return agents;
}
