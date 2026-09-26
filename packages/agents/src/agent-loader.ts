import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_DIFF_BASE } from '@choliba/core/git';
import { parse as parseYaml } from 'yaml';

import type { AgentDefinition, AgentStep, McpDeclaration } from './agent.types';
import type { ExecutionMode, PermissionPolicy } from './command.types';
import { agentSchemaFor, validateAgentYaml, validateSystemMd } from './agent-validation';
import { asBoolean, asString, asStringArray, isRecord } from './json';
import { readAgentPermissions } from './permissions';
import { checkStep, legacyStep, type StepPhase } from './prepare/actions';

export class AgentConfigError extends Error {}

/**
 * Blocks path traversal (`..`, `/`) and anything that would not be a plain directory name.
 * Every agent name — user-supplied on the CLI — is checked against this before it ever
 * touches the filesystem.
 */
const NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

const DEFAULT_MODE: ExecutionMode = 'execute';
const LEGACY_PREPARE_TASK = 'Atualize a documentação com base no contexto entregue.';

export function isValidAgentName(name: string): boolean {
  return NAME_PATTERN.test(name);
}

/** `policy` is optional in agent.yaml: without it, `loadAgent` derives it from system.md's `<permissions>`. */
type YamlFields = Pick<
  AgentDefinition,
  | 'id'
  | 'displayName'
  | 'version'
  | 'description'
  | 'supportedModels'
  | 'skills'
  | 'mcps'
  | 'taskRequired'
  | 'projectRequired'
  | 'ticketTypes'
  | 'defaultMode'
  | 'defaultTask'
  | 'beforeExecute'
  | 'afterExecute'
> & { readonly policy?: PermissionPolicy };

/** The level `<permissions>` implies: any write path means edits, otherwise read-only. */
export function policyFromPermissions(instructions: string): PermissionPolicy {
  return readAgentPermissions(instructions).allowWrite.length > 0 ? 'edits' : 'read-only';
}

function parsePolicy(value: unknown, fail: (reason: string) => never): PermissionPolicy | undefined {
  if (value === undefined) {
    return undefined;
  }
  const policy = asString(value);
  if (policy === 'read-only' || policy === 'edits' || policy === 'full') {
    return policy;
  }
  return fail('invalid "policy" (expected read-only, edits or full)');
}

function parseDefaultMode(value: unknown, fail: (reason: string) => never): ExecutionMode {
  if (value === undefined) {
    return DEFAULT_MODE;
  }
  const mode = asString(value);
  if (mode === 'execute' || mode === 'plan' || mode === 'ask') {
    return mode;
  }
  return fail('invalid "default_mode" (expected execute, plan or ask)');
}

function parseSnapshotFlag(snapshot: Record<string, unknown>, key: string, fail: (reason: string) => never): boolean {
  const value = snapshot[key] === undefined ? true : asBoolean(snapshot[key]);
  if (value === undefined) {
    return fail(`"prepare.snapshot.${key}" must be a boolean when present`);
  }
  return value;
}

function parseSnapshot(value: unknown, fail: (reason: string) => never): { docs: boolean; readme: boolean } {
  if (value === undefined) {
    return { docs: true, readme: true };
  }
  if (!isRecord(value)) {
    return fail('"prepare.snapshot" must be a mapping when present');
  }
  return { docs: parseSnapshotFlag(value, 'docs', fail), readme: parseSnapshotFlag(value, 'readme', fail) };
}

interface LegacyPrepare {
  readonly steps: readonly AgentStep[];
  readonly defaultTask: string;
}

/**
 * The format before `before_execute`, still accepted: `prepare: { kind: working_tree_diff, ... }` becomes
 * the `git_diff` + `add_files` lines that do the same thing.
 */
function parsePrepare(value: unknown, fail: (reason: string) => never): LegacyPrepare | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return fail('"prepare" must be a mapping when present');
  }
  if (asString(value['kind']) !== 'working_tree_diff') {
    return fail('unsupported or missing "prepare.kind" (expected working_tree_diff)');
  }
  const diffFile = asString(value['diff_file']);
  if (diffFile === undefined) {
    return fail('missing or non-string "prepare.diff_file"');
  }
  const sincePendingState = asString(value['since_pending_state']);
  if (sincePendingState === undefined) {
    return fail('missing or non-string "prepare.since_pending_state"');
  }
  const defaultBase = asString(value['default_base']) ?? DEFAULT_DIFF_BASE;
  const snapshot = parseSnapshot(value['snapshot'], fail);
  const steps: AgentStep[] = [{ action: 'git_diff', args: [defaultBase, diffFile, '--pending', sincePendingState] }];
  if (snapshot.docs) {
    steps.push({ action: 'add_files', args: ['documentacao_atual', 'docs/**/*.md'] });
  }
  if (snapshot.readme) {
    steps.push({ action: 'add_files', args: ['readme_atual', 'README.md'] });
  }
  return { steps, defaultTask: asString(value['default_task']) ?? LEGACY_PREPARE_TASK };
}

/** One line: `<action>: [args]` (a one-key mapping), or the legacy string/list form. */
function parseStep(value: unknown, phase: StepPhase, fail: (reason: string) => never): AgentStep {
  const step = parseStepShape(value);
  if (step === undefined) {
    return fail(`each "${phase}" line must be "<action>: [args]", a non-empty string or a non-empty list of strings`);
  }
  const checked = checkStep(step, phase);
  if ('error' in checked) {
    return fail(`"${phase}": ${checked.error}`);
  }
  return step;
}

function parseStepShape(value: unknown): AgentStep | undefined {
  if (isRecord(value)) {
    const entries = Object.entries(value);
    const [entry] = entries;
    const args = entry === undefined ? undefined : asStringArray(entry[1]);
    return entries.length !== 1 || entry === undefined || args === undefined ? undefined : { action: entry[0], args };
  }
  const line = typeof value === 'string' ? value.trim() : asStringArray(value);
  return line === undefined || line.length === 0 ? undefined : legacyStep(line);
}

/** A list of lines run in order. */
function parseSteps(value: unknown, phase: StepPhase, fail: (reason: string) => never): readonly AgentStep[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return fail(`"${phase}" must be a list when present`);
  }
  return value.map((step) => parseStep(step, phase, fail));
}

/** `ticket_types`: a non-empty list, only for an agent that acts on a project (tickets live in one). */
function parseTicketTypes(
  value: unknown,
  projectRequired: boolean,
  fail: (reason: string) => never,
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const types = asStringArray(value);
  if (types === undefined || types.length === 0) {
    return fail('"ticket_types" must be a non-empty array of strings when present');
  }
  if (!projectRequired) {
    return fail('"ticket_types" needs "project_required: true" (tickets belong to a project)');
  }
  return types;
}

/** One server of the map form: `{}`/null (every tool) or `{ tools: [non-empty list] }`. */
function parseMcpEntry(name: string, value: unknown, fail: (reason: string) => never): McpDeclaration {
  if (value === null) {
    return { name };
  }
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'tools')) {
    return fail(`"mcps.${name}" only accepts "tools"`);
  }
  if (value['tools'] === undefined) {
    return { name };
  }
  const tools = asStringArray(value['tools']);
  if (tools === undefined || tools.length === 0) {
    return fail(`"mcps.${name}.tools" must be a non-empty array of strings`);
  }
  return { name, tools };
}

/**
 * `mcps` as a list of server names (every tool of each) or as a map of server name to
 * `{ tools: [...] }` (only those tools); absent is none.
 */
function parseMcps(value: unknown, fail: (reason: string) => never): readonly McpDeclaration[] {
  if (value === undefined) {
    return [];
  }
  if (isRecord(value)) {
    return Object.entries(value).map(([name, entry]) => parseMcpEntry(name, entry, fail));
  }
  const names = asStringArray(value);
  if (names === undefined) {
    return fail('"mcps" must be an array of strings or a map of servers when present');
  }
  return names.map((name) => ({ name }));
}

/**
 * Parses the contents of one `agent.yaml`. Throws `AgentConfigError` naming `source` (the
 * file path) and the missing or malformed field, so a bad agent fails loudly at load time
 * rather than producing an `AgentDefinition` with a blank description downstream.
 */
export function parseAgentYaml(text: string, source: string): YamlFields {
  const fail = (reason: string): never => {
    throw new AgentConfigError(`${source}: ${reason}`);
  };

  let doc: unknown;
  try {
    doc = parseYaml(text) as unknown;
  } catch (error) {
    return fail(`invalid YAML (${String(error)})`);
  }
  if (!isRecord(doc)) {
    return fail('must be a YAML mapping');
  }

  const id = asString(doc['id']);
  if (id === undefined) {
    return fail('missing or non-string "id"');
  }
  const displayName = asString(doc['name']);
  if (displayName === undefined) {
    return fail('missing or non-string "name"');
  }
  const version = asString(doc['version']);
  if (version === undefined) {
    return fail('missing or non-string "version"');
  }
  const description = asString(doc['description']);
  if (description === undefined) {
    return fail('missing or non-string "description"');
  }
  const supportedModels = asStringArray(doc['supported_models']);
  if (supportedModels === undefined) {
    return fail('missing or non-array "supported_models"');
  }
  // Absent entirely (most agents don't list skills) is fine; present-but-wrong-shaped is not.
  const rawSkills = doc['skills'];
  const skills = rawSkills === undefined ? [] : asStringArray(rawSkills);
  if (skills === undefined) {
    return fail('"skills" must be an array of strings when present');
  }
  const mcps = parseMcps(doc['mcps'], fail);

  const policy = parsePolicy(doc['policy'], fail);
  const taskRequired = doc['task_required'] === undefined ? true : asBoolean(doc['task_required']);
  if (taskRequired === undefined) {
    return fail('"task_required" must be a boolean when present');
  }
  const projectRequired = doc['project_required'] === undefined ? false : asBoolean(doc['project_required']);
  if (projectRequired === undefined) {
    return fail('"project_required" must be a boolean when present');
  }
  const ticketTypes = parseTicketTypes(doc['ticket_types'], projectRequired, fail);
  const defaultMode = parseDefaultMode(doc['default_mode'], fail);
  const rawDefaultTask = doc['default_task'];
  const topDefaultTask = asString(rawDefaultTask);
  if (rawDefaultTask !== undefined && topDefaultTask === undefined) {
    return fail('"default_task" must be a string when present');
  }
  const prepare = parsePrepare(doc['prepare'], fail);
  const declaredBefore = parseSteps(doc['before_execute'], 'before_execute', fail);
  if (prepare !== undefined && declaredBefore !== undefined) {
    return fail('use "before_execute" or the legacy "prepare", not both');
  }
  const beforeExecute = declaredBefore ?? prepare?.steps;
  const defaultTask = topDefaultTask ?? prepare?.defaultTask;
  const afterExecute = parseSteps(doc['after_execute'], 'after_execute', fail);

  return {
    id,
    displayName,
    version,
    description,
    supportedModels,
    skills,
    mcps,
    ...(policy !== undefined ? { policy } : {}),
    taskRequired,
    projectRequired,
    ...(ticketTypes === undefined ? {} : { ticketTypes }),
    defaultMode,
    ...(defaultTask !== undefined ? { defaultTask } : {}),
    ...(beforeExecute !== undefined ? { beforeExecute } : {}),
    ...(afterExecute !== undefined ? { afterExecute } : {}),
  };
}

/**
 * Loads one agent from `<agentsDir>/<name>/agent.yaml` + `system.md` — and validates both for
 * real before handing back an `AgentDefinition`: `agent.yaml` against `agent.schema.json`,
 * `system.md` against its schema — `agents/<name>/system.xsd` or the default `agent.xsd` (see `agent-validation.ts`). A schema violation in either file
 * (an unrecognized field, a malformed tag, a missing `<agent>` root…) throws `AgentConfigError`
 * naming every problem found — this is the one place every caller (the CLI, `listAgents`, tests)
 * goes through, so nothing downstream ever sees an agent that fails its own schema.
 */
export async function loadAgent(agentsDir: string, name: string): Promise<AgentDefinition> {
  if (!isValidAgentName(name)) {
    throw new AgentConfigError(`invalid agent name "${name}" (expected lowercase, digits, "-", "_")`);
  }

  const dir = join(agentsDir, name);
  const yamlPath = join(dir, 'agent.yaml');
  const systemPromptPath = join(dir, 'system.md');

  let yamlText: string;
  try {
    yamlText = readFileSync(yamlPath, 'utf8');
  } catch {
    throw new AgentConfigError(`agent "${name}" not found: ${yamlPath} does not exist`);
  }

  let instructions: string;
  try {
    instructions = readFileSync(systemPromptPath, 'utf8');
  } catch {
    throw new AgentConfigError(`agent "${name}" is missing ${systemPromptPath}`);
  }

  const fields = parseAgentYaml(yamlText, yamlPath);

  const yamlValidation = validateAgentYaml(yamlText);
  const systemSchema = agentSchemaFor(dir);
  const systemMdValidation = await validateSystemMd(instructions, systemSchema);
  const schemaErrors = [
    ...yamlValidation.errors.map((error) => `${yamlPath}: ${error}`),
    ...systemMdValidation.errors.map((error) => `${systemPromptPath} (schema ${systemSchema.path}): ${error}`),
  ];
  if (schemaErrors.length > 0) {
    throw new AgentConfigError(`agent "${name}" failed schema validation:\n${schemaErrors.join('\n')}`);
  }

  return { name, dir, systemPromptPath, instructions, ...fields, policy: fields.policy ?? policyFromPermissions(instructions) };
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
