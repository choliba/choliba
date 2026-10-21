import { parse as parseYaml } from 'yaml';

import { ExpectedError } from '@choliba/kernel';

import type {
  AgentAfterSteps,
  AgentColor,
  AgentDefinition,
  AgentModeSteps,
  AgentStep,
  McpDeclaration,
  SkillDeclaration,
} from './agent.interface';
import type { ExecutionMode, PermissionPolicy } from '../common';
import { validateAgentYamlV1 } from './agent-validation';
import { type AgentPermissions, readAgentPermissions } from '../permissions';
import { PROJECT_VARS, TICKET_VARS, varProblems } from './agent-vars';

export type StepPhase = 'before_execute' | 'after_execute';

export type CheckAgentStep = (step: AgentStep, phase: StepPhase) => object | { readonly error: string };

export class AgentConfigError extends ExpectedError {}

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
const HAS_VAR = /\$\{[A-Z_][A-Z0-9_]*\}/;

export function isValidAgentName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

/** What `agent.yaml` says; `loadAgent` adds where it is and what is derived from the whole file. */
export type AgentYamlFields = Omit<AgentDefinition, 'name' | 'dir' | 'sourcePath' | 'projectRequired'>;

/** `edits` when the agent may write or delete somewhere, `read-only` otherwise. */
export function policyFromPermissions(permissions: AgentPermissions): PermissionPolicy {
  return permissions.allowWrite.length > 0 || permissions.allowDelete.length > 0 ? 'edits' : 'read-only';
}

/** A step as agent.yaml writes it: a list of arguments, or named fields (a number, as `max_size: 40960`, is a text). */
type StepValue = readonly string[] | Readonly<Record<string, string | number | readonly string[]>>;

type StepLines = readonly Readonly<Record<string, StepValue>>[];

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
    readonly color?: AgentColor;
  };
  readonly providers: Readonly<Record<string, { readonly models: readonly string[] }>>;
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
  readonly allow_without_ticket?: boolean;
  readonly steps?: Readonly<Partial<Record<ExecutionMode, ModeStepsYaml>>>;
}

/** `modes.allow` (all three when absent) and `modes.default` (`execute` when allowed, else the first allowed). */
function parseModes(modes: AgentYamlV1['modes']): { modes: readonly ExecutionMode[]; defaultMode: ExecutionMode } {
  const allowed = modes?.allow ?? ALL_MODES;
  const fallback = allowed.includes('execute') ? 'execute' : allowed[0];
  return { modes: allowed, defaultMode: modes?.default ?? fallback };
}

/** A step as the actions take it: its arguments, or its named fields with each number as a text. */
function toStep(action: string, value: StepValue): AgentStep {
  if (isList(value)) return { action, args: value };
  const options = Object.fromEntries(
    Object.entries(value).map(([name, field]) => [name, typeof field === 'number' ? String(field) : field]),
  );
  return { action, args: [], options };
}

/** Each step, `<action>: [args]` or `<action>: { fields }`, checked against the action's own rules. */
function parseStepList(
  lines: StepLines | undefined,
  phase: StepPhase,
  fail: (reason: string) => never,
  checkStep: CheckAgentStep,
): readonly AgentStep[] {
  return (lines ?? []).flatMap((line) =>
    Object.entries(line).map(([action, value]) => {
      const step = toStep(action, value);
      const checked = checkStep(step, phase);
      return 'error' in checked ? fail(`"steps": ${checked.error}`) : step;
    }),
  );
}

/** `Array.isArray` does not narrow a readonly array out of a union; this does. */
function isList<Item>(value: readonly Item[] | object): value is readonly Item[] {
  return Array.isArray(value);
}

/** `after`: a plain list is `always`; otherwise the `success`/`failure`/`always` blocks it has. */
function parseAfter(
  after: ModeStepsYaml['after'],
  fail: (reason: string) => never,
  checkStep: CheckAgentStep,
): AgentAfterSteps {
  if (after === undefined) {
    return { success: [], failure: [], always: [] };
  }
  const blocks: AfterBlocks = isList(after) ? { always: after } : after;
  return {
    success: parseStepList(blocks.success, 'after_execute', fail, checkStep),
    failure: parseStepList(blocks.failure, 'after_execute', fail, checkStep),
    always: parseStepList(blocks.always, 'after_execute', fail, checkStep),
  };
}

function parseModeSteps(
  steps: ModeStepsYaml | undefined,
  fail: (reason: string) => never,
  checkStep: CheckAgentStep,
): AgentModeSteps {
  return {
    before: parseStepList(steps?.before, 'before_execute', fail, checkStep),
    after: parseAfter(steps?.after, fail, checkStep),
  };
}

/** `steps` for every mode; a mode the file does not name gets empty lists. */
function parseSteps(
  steps: AgentYamlV1['steps'],
  fail: (reason: string) => never,
  checkStep: CheckAgentStep,
): Readonly<Record<ExecutionMode, AgentModeSteps>> {
  return {
    execute: parseModeSteps(steps?.execute, fail, checkStep),
    plan: parseModeSteps(steps?.plan, fail, checkStep),
    ask: parseModeSteps(steps?.ask, fail, checkStep),
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

/** `providers` as the agent declares them, in the file's order. */
function declaredProviders(providers: AgentYamlV1['providers']): Pick<AgentDefinition, 'providers'> {
  return { providers: Object.entries(providers).map(([id, { models }]) => ({ id, models })) };
}

/**
 * `${NAME}` is only filled in the texts `mapAgentTexts` goes through; in a fixed value of the
 * declaration (the identity, the providers and models, the task, the tools of an MCP) it would stay as written.
 */
function misplacedVars(doc: AgentYamlV1, mcps: readonly McpDeclaration[]): readonly string[] {
  const fixed: Readonly<Record<string, unknown>> = {
    agent: doc.agent,
    providers: doc.providers,
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
export function parseAgentYaml(
  text: string,
  source: string,
  folder: string,
  checkStep: CheckAgentStep,
): AgentYamlFields {
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
  const fields: AgentYamlFields = {
    id: doc.agent.id,
    displayName: doc.agent.name,
    version: doc.agent.version,
    description: doc.agent.description,
    // The schema already took only the names the theme has; the guard just tells TypeScript so.
    ...(doc.agent.color === undefined ? {} : { color: doc.agent.color }),
    ...declaredProviders(doc.providers),
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
    allowWithoutTicket: doc.allow_without_ticket === true,
    ...parseModes(doc.modes),
    ...(doc.task?.default === undefined ? {} : { defaultTask: doc.task.default }),
    steps: parseSteps(doc.steps, fail, checkStep),
  };
  const problems = [...varProblems(fields), ...misplacedVars(doc, mcps)];
  return problems.length === 0 ? fields : fail(problems.join('\n'));
}

/** Whether a run needs `--project`: the agent uses a project variable anywhere, or works on tickets. */
export function agentNeedsProject(yamlText: string, fields: AgentYamlFields): boolean {
  return fields.ticketTypes !== undefined || PROJECT_VAR.test(yamlText);
}
