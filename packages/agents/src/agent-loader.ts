import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

import type {
  AgentAfterSteps,
  AgentDefinition,
  AgentModeSteps,
  AgentStep,
  McpDeclaration,
  SkillDeclaration,
} from './agent.types';
import type { ExecutionMode, PermissionPolicy } from './command.types';
import { validateAgentYamlV1 } from './agent-validation';
import { type AgentPermissions, readAgentPermissions } from './permissions';
import { checkStep, type StepPhase } from './prepare/actions';
import { PROJECT_VARS, TICKET_VARS, varProblems } from './vars';
import { AGENT_FILE } from '@choliba/core/config';

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

function anyVarOf(names: readonly string[]): RegExp {
  return new RegExp(`\\$\\{(${names.join('|')})\\}`);
}

/** The variables that only have a value when the run has a project (and, for the ticket ones, a ticket). */
const PROJECT_VAR = anyVarOf([...PROJECT_VARS, ...TICKET_VARS]);

/** The variables that only have a value when the run has a ticket, which needs `ticket_types`. */
const TICKET_VAR = anyVarOf(TICKET_VARS);

const HAS_VAR = /\$\{[A-Z_][A-Z0-9_]*\}/;

export function isValidAgentName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

/** What `agent.yaml` says; `loadAgent` adds where it is and what is derived from the whole file. */
type YamlFields = Omit<AgentDefinition, 'name' | 'dir' | 'sourcePath' | 'projectRequired'>;

/** `edits` when the agent may write somewhere, `read-only` otherwise. */
export function policyFromPermissions(permissions: AgentPermissions): PermissionPolicy {
  return permissions.allowWrite.length > 0 ? 'edits' : 'read-only';
}

type StepLines = readonly Readonly<Record<string, readonly string[]>>[];

interface AfterBlocks {
  readonly success?: StepLines;
  readonly failure?: StepLines;
  readonly always?: StepLines;
}

interface ModeStepsYaml {
  readonly before?: StepLines;
  readonly after?: StepLines | AfterBlocks;
}

type NameList = readonly string[];
type SkillMap = Readonly<Record<string, { readonly instructions: string } | null>>;
type McpMap = Readonly<Record<string, { readonly tools?: readonly string[]; readonly instructions?: string } | null>>;

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
  readonly role: string;
  readonly context?: readonly string[];
  readonly input: string;
  readonly flow: string;
  readonly output: string;
  readonly notes?: readonly string[];
  readonly skills?: NameList | SkillMap;
  readonly mcps?: NameList | McpMap;
  readonly permissions?: unknown;
  readonly modes?: { readonly allow?: Modes; readonly default?: ExecutionMode };
  readonly task?: { readonly required?: boolean; readonly default?: string };
  readonly ticket_types?: readonly string[];
  readonly steps?: Readonly<Partial<Record<ExecutionMode, ModeStepsYaml>>>;
}

/** `modes.allow` (all three when absent) and `modes.default` (`execute` when allowed, else the first allowed). */
function parseModes(modes: AgentYamlV1['modes']): { modes: readonly ExecutionMode[]; defaultMode: ExecutionMode } {
  const allowed = modes?.allow ?? ALL_MODES;
  const fallback = allowed.includes('execute') ? 'execute' : allowed[0];
  return { modes: allowed, defaultMode: modes?.default ?? fallback };
}

/** Each step, `<action>: [args]`, checked against the action's own rules (e.g. `git_diff`'s arguments). */
function parseStepList(
  lines: StepLines | undefined,
  phase: StepPhase,
  fail: (reason: string) => never,
): readonly AgentStep[] {
  return (lines ?? []).flatMap((line) =>
    Object.entries(line).map(([action, args]) => {
      const checked = checkStep({ action, args }, phase);
      return 'error' in checked ? fail(`"steps": ${checked.error}`) : { action, args };
    }),
  );
}

/** `Array.isArray` does not narrow a readonly array out of a union; this does. */
function isList<Item>(value: readonly Item[] | object): value is readonly Item[] {
  return Array.isArray(value);
}

/** `after`: a plain list is `always`; otherwise the `success`/`failure`/`always` blocks it has. */
function parseAfter(after: ModeStepsYaml['after'], fail: (reason: string) => never): AgentAfterSteps {
  if (after === undefined) {
    return { success: [], failure: [], always: [] };
  }
  const blocks: AfterBlocks = isList(after) ? { always: after } : after;
  return {
    success: parseStepList(blocks.success, 'after_execute', fail),
    failure: parseStepList(blocks.failure, 'after_execute', fail),
    always: parseStepList(blocks.always, 'after_execute', fail),
  };
}

function parseModeSteps(steps: ModeStepsYaml | undefined, fail: (reason: string) => never): AgentModeSteps {
  return {
    before: parseStepList(steps?.before, 'before_execute', fail),
    after: parseAfter(steps?.after, fail),
  };
}

/** `steps` for every mode; a mode the file does not name gets empty lists. */
function parseSteps(
  steps: AgentYamlV1['steps'],
  fail: (reason: string) => never,
): Readonly<Record<ExecutionMode, AgentModeSteps>> {
  return {
    execute: parseModeSteps(steps?.execute, fail),
    plan: parseModeSteps(steps?.plan, fail),
    ask: parseModeSteps(steps?.ask, fail),
  };
}

/** `skills` as a list of names or a map of name to `{ instructions }` or null. */
function parseSkills(skills: AgentYamlV1['skills']): readonly SkillDeclaration[] {
  if (skills === undefined) {
    return [];
  }
  if (isList(skills)) {
    return skills.map((name) => ({ name }));
  }
  return Object.entries(skills).map(([name, entry]) => (entry === null ? { name } : { name, ...entry }));
}

/** `mcps` as a list of server names (every tool of each) or a map of server name to `{ tools?, instructions? }` or null. */
function parseMcps(mcps: AgentYamlV1['mcps']): readonly McpDeclaration[] {
  if (mcps === undefined) {
    return [];
  }
  if (isList(mcps)) {
    return mcps.map((name) => ({ name }));
  }
  return Object.entries(mcps).map(([name, entry]) => (entry === null ? { name } : { name, ...entry }));
}

/**
 * `${NAME}` is only filled in the texts `mapAgentTexts` goes through; in a fixed value of the
 * declaration (the identity, the models, the task, the tools of an MCP) it would stay as written.
 */
function misplacedVars(doc: AgentYamlV1, mcps: readonly McpDeclaration[]): readonly string[] {
  const fixed: Readonly<Record<string, unknown>> = {
    agent: doc.agent,
    models: doc.models,
    task: doc.task,
    'mcps.tools': mcps.flatMap((mcp) => mcp.tools ?? []),
  };
  return Object.entries(fixed)
    .filter(([, value]) => HAS_VAR.test(JSON.stringify(value ?? null)))
    .map(([field]) => `${field} não aceita \${…}: é um valor fixo da declaração`);
}

/**
 * Parses one `agent.yaml` of standard 1, in the folder `folder`. The file is checked by
 * `validateAgentYamlV1` first (version, schema, `agent.id` = folder, modes), so what is read below
 * already has the right shape; then every `${NAME}` is checked against the catalog (`AGENT_VARS`). A
 * problem throws `AgentConfigError` naming `source` and every error found.
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
  const mcps = parseMcps(doc.mcps);
  const fields: YamlFields = {
    id: doc.agent.id,
    displayName: doc.agent.name,
    version: doc.agent.version,
    description: doc.agent.description,
    supportedModels: doc.models,
    sections: {
      role: doc.role,
      context: doc.context ?? [],
      input: doc.input,
      flow: doc.flow,
      output: doc.output,
      notes: doc.notes ?? [],
    },
    skills: parseSkills(doc.skills),
    mcps,
    permissions,
    policy: policyFromPermissions(permissions),
    taskRequired: doc.task?.required ?? true,
    ...(doc.ticket_types === undefined ? {} : { ticketTypes: doc.ticket_types }),
    ...parseModes(doc.modes),
    ...(doc.task?.default === undefined ? {} : { defaultTask: doc.task.default }),
    steps: parseSteps(doc.steps, fail),
  };
  const problems = [...varProblems(fields), ...misplacedVars(doc, mcps)];
  return problems.length === 0 ? fields : fail(problems.join('\n'));
}

/** Whether a run needs `--project`: the agent uses a project variable anywhere, or works on tickets. */
function needsProject(yamlText: string, fields: YamlFields): boolean {
  return fields.ticketTypes !== undefined || PROJECT_VAR.test(yamlText);
}

/**
 * Loads one agent from `<agentsDir>/<name>/agent.yaml`, its whole declaration, and validates it for
 * real before handing back an `AgentDefinition` (`parseAgentYaml`). A violation throws
 * `AgentConfigError` naming every problem found — this is the one place every caller (the CLI,
 * `listAgents`, tests) goes through, so nothing downstream ever sees an agent that fails its schema.
 */
export function loadAgent(agentsDir: string, name: string): AgentDefinition {
  if (!isValidAgentName(name)) {
    throw new AgentConfigError(`invalid agent name "${name}" (expected lowercase, digits, "-", "_")`);
  }

  const dir = join(agentsDir, name);
  const sourcePath = join(dir, AGENT_FILE);

  let yamlText: string;
  try {
    yamlText = readFileSync(sourcePath, 'utf8');
  } catch {
    throw new AgentConfigError(`agent "${name}" not found: ${sourcePath} does not exist`);
  }
  const fields = parseAgentYaml(yamlText, sourcePath, name);
  if (fields.ticketTypes === undefined && TICKET_VAR.test(yamlText)) {
    throw new AgentConfigError(
      `agent "${name}" usa \${TICKET} ou \${TICKET_FILE}, mas não declara ticket_types: é por eles que o CLI ` +
        `resolve o ticket da execução (${sourcePath})`,
    );
  }

  return {
    name,
    dir,
    sourcePath,
    ...fields,
    projectRequired: needsProject(yamlText, fields),
  };
}

/**
 * Lists every agent in `agentsDir`: each subdirectory that has an `agent.yaml`. A directory
 * starting with `_` is skipped without needing an `agent.yaml` check first.
 */
export function listAgents(agentsDir: string): readonly AgentDefinition[] {
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
      agents.push(loadAgent(agentsDir, entry));
    } catch {
      // Not every directory here need be a well-formed agent (or an agent at all); listAgents
      // surfaces the ones that load, loadAgent is where a specific failure is reported.
      continue;
    }
  }
  return agents;
}
