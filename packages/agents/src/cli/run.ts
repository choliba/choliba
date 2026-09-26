import { isAbsolute, join, relative } from 'node:path';

import type { ProcessRunner, SignalSource, Writable } from '@choliba/terminal';
import { isAnsiColor, paint } from '@choliba/terminal';
import { complete, describe, formatHelp, formatSuggestions } from '@choliba/core/cli';
import type { GitRunner } from '@choliba/core/git';
import { createSpawnGitRunner } from '@choliba/core/git';

import type { AgentDefinition, AgentPhase } from '../agent.types';
import { listAgents, loadAgent } from '../agent-loader';
import { resolveCommand } from '../command-registry';
import { commandFromAgent, effectivePolicy } from '../define-command';
import type { CommandDefinition, ExecutionMode } from '../command.types';
import { buildUserPrompt } from '../prompt';
import type { McpServer } from '../mcps';
import { resolveMcps } from '../mcps';
import type { SkillSummary } from '../skills';
import { formatSkillsInstruction, resolveSkills } from '../skills';
import type { ProviderRequest } from '../providers/provider.types';
import { parseProviderPreference, resolveProvider } from '../providers/registry';
import { readPlan } from '../plan-store';
import { validateExplicitModel } from '../providers/stream-json';
import { runAgent } from '../run-agent';
import { CHOL_AGENTS_PROVIDER } from '@choliba/core/config';
import {
  listProjectNames,
  listTicketKeys,
  loadProjectSettings,
  readProjectConfig,
  resolveLocations,
} from '@choliba/projects';
import { readAgentPermissions } from '../permissions';
import { agentInPhase, selectPhases } from '../phases';
import { definedConfig, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '../workspace-dirs';
import { permissionDirs, withExpandedInstructions } from '../vars';
import type { AgentsArgsError, ParsedAgentsArgs } from './args';
import { CLI_PROGRAM_NAME, PREPARE_FLAGS, USAGE, parseAgentsArgs, unknownFlagMessage } from './args';
import type { TicketTarget } from './ticket-run';
import { createPlannedTicket, finishTicket, resolveTicketTarget, ticketVars } from './ticket-run';
import type { AgentsCliSpecContext } from './cli-spec';
import { agentCommandSpec, agentFlagNames, agentsCliSpec } from './cli-spec';

export interface RunAgentsCliDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the `Bun`
   * global. `cli/main.ts` passes its own; every spec passes a fake.
   */
  readonly runner: ProcessRunner;
  /** `Bun.which` in production; a lookup table in specs. */
  readonly which: (bin: string) => string | null;
  readonly repoRoot: string;
  readonly commands: readonly CommandDefinition[];
  readonly config: Readonly<Record<string, string | undefined>>;
  readonly now: () => Date;
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly signals: SignalSource;
  /** Reads branches and tags for `--since` completion; defaults to spawning the real `git`. */
  readonly git?: GitRunner;
}

function toAbsolute(path: string, repoRoot: string): string {
  return isAbsolute(path) ? path : join(repoRoot, path);
}

/** `dir === parent` counts as inside — `relative` returns `''` for that case. */
function isInside(parent: string, dir: string): boolean {
  const rel = relative(parent, dir);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** Trims a long argument for `--dry-run` output — nobody needs the full 30 KB system prompt on screen. */
function shorten(value: string): string {
  const bytes = Buffer.byteLength(value, 'utf8');
  return bytes <= 200 ? value : `${value.slice(0, 60)}…(${String(bytes)} bytes)`;
}

function errorMessage(error: unknown): string {
  return String(error);
}

const HELP_WIDTH = 80;

/** Greedy word-wrap: never breaks a word, never exceeds `width` unless a single word already does. */
function wrapText(text: string, width: number): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '');
  if (words.length === 0) {
    return [''];
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length > width && current !== '') {
      lines.push(current);
      current = word;
      continue;
    }
    current = candidate;
  }
  lines.push(current);
  return lines;
}

/** A YAML-style list: `key:` followed by one `  - item` per entry, or `key: []` when empty. */
function formatYamlList(key: string, items: readonly string[]): string {
  if (items.length === 0) {
    return `${key}: []`;
  }
  return [`${key}:`, ...items.map((item) => `  - ${item}`)].join('\n');
}

/**
 * Agent metadata in the same shape as `--help` (without CLI usage): `agent.yaml` fields plus
 * resolved command policy. The free-text description is wrapped to `HELP_WIDTH`.
 */
function formatAgentDetail(command: CommandDefinition, agent: AgentDefinition): string {
  return [
    `id: ${agent.id}`,
    `name: ${agent.displayName}`,
    `version: ${agent.version}`,
    ...wrapText(agent.description, HELP_WIDTH),
    formatYamlList('supported_models', agent.supportedModels),
    formatYamlList('skills', agent.skills),
    ...(agent.ticketTypes === undefined ? [] : [formatYamlList('ticket_types', agent.ticketTypes)]),
    ...(agent.phases === undefined ? [] : [formatYamlList('phases', agent.phases.map((phase) => phase.name))]),
    formatYamlList(
      'mcps',
      agent.mcps.map((mcp) =>
        mcp.tools === undefined ? mcp.name : [`${mcp.name}:`, ...mcp.tools.map((tool) => `    - ${tool}`)].join('\n'),
      ),
    ),
    '',
    `Policy: ${command.policy} | Modo padrão: ${command.defaultMode} | Task obrigatória: ${command.taskRequired ? 'sim' : 'não'} | Projeto obrigatório: ${agent.projectRequired ? 'sim' : 'não'}`,
  ].join('\n');
}

function projectsDir(deps: RunAgentsCliDeps): string {
  return resolveLocations(deps.repoRoot, deps.config, () => undefined).PROJECTS_DIR;
}

/** The projects `--project` completes to; none when the locations are not configured or the folder is missing. */
function projectNames(deps: RunAgentsCliDeps): readonly string[] {
  try {
    return listProjectNames(projectsDir(deps));
  } catch {
    return [];
  }
}

/** The ticket keys `--ticket` completes to, of every project; none when the projects are not reachable. */
function ticketKeys(deps: RunAgentsCliDeps): readonly string[] {
  try {
    const dir = projectsDir(deps);
    return listProjectNames(dir).flatMap((project) => listTicketKeys(dir, project));
  } catch {
    return [];
  }
}

function specContext(agents: readonly AgentDefinition[], deps: RunAgentsCliDeps): AgentsCliSpecContext {
  return {
    agents,
    repoRoot: deps.repoRoot,
    git: deps.git ?? createSpawnGitRunner(),
    projects: () => projectNames(deps),
    tickets: () => ticketKeys(deps),
  };
}

/** `--help`/`-h` after a command name — usage, the agent's detail block, then its options. */
function formatAgentHelp(command: CommandDefinition, agent: AgentDefinition, deps: RunAgentsCliDeps): string {
  return formatHelp(agentCommandSpec(agent, specContext([], deps), formatAgentDetail(command, agent)));
}

/** Global `--help`, listing the agents found in the default agents dir right now. */
async function runHelp(deps: RunAgentsCliDeps): Promise<number> {
  const agents = await listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  deps.stdout.write(`${formatHelp(agentsCliSpec(specContext(agents, deps)))}\n`);
  return 0;
}

/** `agents __describe <words...>`: one line describing what the words select, read by `bun chol:help`. */
async function runDescribe(words: readonly string[], deps: RunAgentsCliDeps): Promise<number> {
  const agents = await listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  deps.stdout.write(`${describe(agentsCliSpec(specContext(agents, deps)), words)}\n`);
  return 0;
}

/** `agents __complete <words...>`: one suggestion per line, read by scripts/libs/chol-completion.bash. */
async function runComplete(words: readonly string[], deps: RunAgentsCliDeps): Promise<number> {
  const agents = await listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  const output = formatSuggestions(complete(agentsCliSpec(specContext(agents, deps)), words));
  if (output !== '') {
    deps.stdout.write(`${output}\n`);
  }
  return 0;
}

async function runList(kind: Extract<ParsedAgentsArgs, { kind: 'list' }>, deps: RunAgentsCliDeps): Promise<number> {
  const agentsDir = resolveAgentsDir(kind.agentsDir, deps.config, deps.repoRoot);
  const agents = await listAgents(agentsDir);
  if (agents.length === 0) {
    deps.stdout.write(`No agents found in ${agentsDir}\n`);
    return 0;
  }
  const blocks = agents.map((agent) => formatAgentDetail(commandFromAgent(agent), agent));
  deps.stdout.write(`${blocks.join('\n\n')}\n`);
  return 0;
}

type RunArgs = Extract<ParsedAgentsArgs, { kind: 'run' }>;

/** Step 1: which command, and which agent it loads — the only two things every later step needs. */
async function resolveAgentForCommand(
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
  agentsDir: string,
): Promise<{ command: CommandDefinition; agent: AgentDefinition } | undefined> {
  let command: CommandDefinition | undefined;
  try {
    command = await resolveCommand(parsed.command, deps.commands, agentsDir);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
  if (command === undefined) {
    deps.stderr.write(
      `Unknown command "${parsed.command}". Run "${CLI_PROGRAM_NAME} list" to see available agents.\n${USAGE}\n`,
    );
    return undefined;
  }
  try {
    const agent = await loadAgent(agentsDir, command.agent);
    return { command, agent };
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The first flag on the command line that is not in this agent's own `--help`, if any. A command
 * defined in code with its own `prepare` also takes the diff-base flags, which it receives as `since`.
 */
function foreignFlag(
  parsed: RunArgs,
  command: CommandDefinition,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): string | undefined {
  const accepted = new Set([
    ...agentFlagNames(agent, specContext([], deps)),
    ...(command.prepare === undefined ? [] : PREPARE_FLAGS),
  ]);
  return parsed.flags.find((flag) => !accepted.has(flag));
}

/**
 * Pre-flight: when `--model` is explicit, it must be one `agent.yaml#supported_models` actually
 * declares — checked before resolving a provider or building a prompt, so a bad model never gets
 * anywhere near invoking one. An agent with no declared models (`supportedModels.length === 0`)
 * has nothing to validate against, so anything goes for it. `true` means "ok to proceed"; on
 * `false` the error (naming every supported model) has already been written to `stderr`.
 */
function checkModelSupported(parsed: RunArgs, agent: AgentDefinition, deps: RunAgentsCliDeps): boolean {
  if (parsed.model === undefined) {
    return true;
  }
  const error = validateExplicitModel(parsed.model, agent.supportedModels, agent.name);
  if (error === undefined) {
    return true;
  }
  deps.stderr.write(`${error}\n`);
  return false;
}

/**
 * The skills the agent lists, found in the skills dir. A missing or malformed skill stops the run
 * here, before any provider is involved; the error (naming the file) is already on `stderr`.
 */
function resolveAgentSkills(
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): { skillsDir: string; skills: readonly SkillSummary[] } | undefined {
  const skillsDir = resolveSkillsDir(deps.config, deps.repoRoot);
  try {
    return { skillsDir, skills: resolveSkills(skillsDir, agent.skills) };
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The MCP servers the agent lists, found in the mcps dir. A missing or malformed server stops the
 * run here, before any provider is involved; the error (naming the file) is already on `stderr`.
 */
function resolveAgentMcps(agent: AgentDefinition, deps: RunAgentsCliDeps): readonly McpServer[] | undefined {
  try {
    return resolveMcps(resolveMcpsDir(deps.config, deps.repoRoot), agent.mcps, definedConfig(deps.config));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The folders an agent's `system.md` may name, so it never depends on the workspace layout:
 * `${AGENTS_DIR}`, `${SKILLS_DIR}` and `${MCPS_DIR}` always; `${GLOBAL_DIR}`, `${PROJECTS_DIR}` and
 * `${TICKET_RUNS}` once GLOBAL_DIR is configured; `${PROJECT}`/`${PROJECT_DIR}`/`${APP_DIR}` (the active
 * environment's application code) when the run has a project — all from `@choliba/projects` and
 * `workspace-dirs`, this CLI works out no path itself.
 */
function locationVars(
  deps: RunAgentsCliDeps,
  projectVars: Readonly<Record<string, string>>,
  instructions: string,
): Readonly<Record<string, string>> {
  // Resolved only when used: an agent naming none of them runs without GLOBAL_DIR, and one that does
  // gets the clear "GLOBAL_DIR não definida" instead of a missing variable.
  const locations = /\$\{(GLOBAL_DIR|PROJECTS_DIR|TICKET_RUNS)\}/.test(instructions)
    ? resolveLocations(deps.repoRoot, deps.config, () => undefined)
    : undefined;
  return {
    AGENTS_DIR: resolveAgentsDir(undefined, deps.config, deps.repoRoot),
    SKILLS_DIR: resolveSkillsDir(deps.config, deps.repoRoot),
    MCPS_DIR: resolveMcpsDir(deps.config, deps.repoRoot),
    ...(locations === undefined
      ? {}
      : {
          GLOBAL_DIR: locations.GLOBAL_DIR,
          PROJECTS_DIR: locations.PROJECTS_DIR,
          ...(locations.TICKET_RUNS === undefined ? {} : { TICKET_RUNS: locations.TICKET_RUNS }),
        }),
    ...projectVars,
  };
}

/**
 * Pre-flight for `--project`: required when the agent declares `project_required`, and, when given,
 * checked by `@choliba/projects` (`loadProjectSettings`: files, active environment, no
 * `CHANGE_ME`) — never by this CLI and never by the agent. A project that is not ready stops the run
 * here, with the resolver's message on `stderr`; the provider is never called.
 */
function resolveProjectVars(
  parsed: RunArgs,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): Readonly<Record<string, string>> | undefined {
  if (parsed.project === undefined) {
    if (!agent.projectRequired) {
      return {};
    }
    deps.stderr.write(`Project is required for "${agent.name}": pass --project <name>. ${USAGE}\n`);
    return undefined;
  }
  try {
    const settings = loadProjectSettings(projectsDir(deps), parsed.project);
    return { PROJECT: settings.project, PROJECT_DIR: settings.projectPath, APP_DIR: settings.appDir };
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The ticket this run works on (`--type`/`--ticket`, see `ticket-run.ts`): `undefined` for an agent
 * without `ticket_types`, `null` when the flags do not fit the agent — the reason is already on `stderr`.
 */
function resolveRunTicket(parsed: RunArgs, agent: AgentDefinition, deps: RunAgentsCliDeps): TicketTarget | undefined | null {
  try {
    return resolveTicketTarget(agent, parsed, () => projectsDir(deps));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return null;
  }
}

/** The agent with its `${…}` variables filled in; a missing one stops the run here, before any provider. */
function expandAgent(
  agent: AgentDefinition,
  projectVars: Readonly<Record<string, string>>,
  deps: RunAgentsCliDeps,
): AgentDefinition | undefined {
  try {
    return withExpandedInstructions(agent, () => locationVars(deps, projectVars, agent.instructions));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/** Step 2: the effective mode and task text, after the `--plan-from`/`taskRequired` checks. */
function resolveTaskAndMode(
  parsed: RunArgs,
  command: CommandDefinition,
  deps: RunAgentsCliDeps,
): { mode: ExecutionMode; task: string } | undefined {
  const mode: ExecutionMode = parsed.mode ?? command.defaultMode;
  if (parsed.planFrom !== undefined && mode !== 'execute') {
    deps.stderr.write(
      `--plan-from can only be used with --mode execute (or no --mode, on a command whose default is execute). ${USAGE}\n`,
    );
    return undefined;
  }
  if (parsed.task === '' && parsed.planFrom === undefined && command.taskRequired) {
    deps.stderr.write(`Task is required for "${command.name}". ${USAGE}\n`);
    return undefined;
  }
  const task = parsed.task === '' && parsed.planFrom !== undefined ? 'Continue with the plan above.' : parsed.task;
  return { mode, task };
}

/** Step 3: the resumed plan's content, if `--plan-from` was given — `undefined` inside the object is a valid "no plan"; `undefined` as the whole result is the failure case. */
function resolvePlanContent(parsed: RunArgs, deps: RunAgentsCliDeps): { planContent: string | undefined } | undefined {
  if (parsed.planFrom === undefined) {
    return { planContent: undefined };
  }
  const planPath = toAbsolute(parsed.planFrom, deps.repoRoot);
  try {
    return { planContent: readPlan(planPath) };
  } catch (error) {
    deps.stderr.write(`Could not read plan "${planPath}": ${errorMessage(error)}\n`);
    return undefined;
  }
}

/** Step 4: extra directories the provider may touch — the command's own, `--add-dir`, and the agents dir itself when it sits outside the workspace root. Never fails. */
function resolveAddDirs(
  command: CommandDefinition,
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
  readDirs: readonly string[],
): string[] {
  const addDirs = [
    ...command.addDirs.map((dir) => toAbsolute(dir, deps.repoRoot)),
    ...parsed.addDirs.map((dir) => toAbsolute(dir, deps.repoRoot)),
  ];
  // Directories the agent must read (its own dir, its skills) that live outside the workspace
  // root (e.g. --agents-dir or CHOL_SKILLS_DIR pointing at another repo): the provider cannot read
  // files there unless each is explicitly granted — the workspace root alone is not enough.
  for (const dir of readDirs) {
    if (!isInside(deps.repoRoot, dir)) {
      addDirs.push(dir);
    }
  }
  return addDirs;
}

/** Step 5: which provider binary this run actually talks to. */
function resolveProviderChoice(
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
): ReturnType<typeof resolveProvider> | undefined {
  try {
    const providerPreference = parseProviderPreference(parsed.provider ?? deps.config[CHOL_AGENTS_PROVIDER]);
    return resolveProvider(providerPreference, deps.which);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/** Step 6: the actual `ProviderRequest`, via the command's `prepare` hook (or plain `prompt`) — and the task that hook may have rewritten. */
function buildProviderRequest(
  command: CommandDefinition,
  agent: AgentDefinition,
  mode: ExecutionMode,
  task: string,
  planContent: string | undefined,
  addDirs: readonly string[],
  skillsInstruction: string,
  mcpServers: readonly McpServer[],
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
): { effectiveTask: string; providerRequest: ProviderRequest } | undefined {
  let templateOutput: string;
  let effectiveTask = task;

  if (command.prepare !== undefined) {
    try {
      const prepareInput =
        parsed.since === undefined
          ? { task, repoRoot: deps.repoRoot, agent, mode }
          : { task, repoRoot: deps.repoRoot, agent, mode, since: parsed.since };
      const prepared = command.prepare(prepareInput);
      templateOutput = prepared.promptBody;
      effectiveTask = prepared.task;
    } catch (error) {
      deps.stderr.write(`${errorMessage(error)}\n`);
      return undefined;
    }
  } else {
    templateOutput = command.prompt({ task, repoRoot: deps.repoRoot, agent });
  }

  const providerRequest: ProviderRequest = {
    agent,
    mode,
    policy: effectivePolicy(command, mode),
    userPrompt: buildUserPrompt({ templateOutput, mode, planContent }),
    workspaceRoot: deps.repoRoot,
    addDirs: [...addDirs],
    model: parsed.model,
    ...(skillsInstruction === '' ? {} : { skillsInstruction }),
    ...(mcpServers.length === 0 ? {} : { mcpServers }),
  };
  return { effectiveTask, providerRequest };
}

/** `--dry-run`: print the args that would reach the provider, never spawn it. */
function runDryRun(
  resolved: ReturnType<typeof resolveProvider>,
  providerRequest: ProviderRequest,
  deps: RunAgentsCliDeps,
): number {
  let args: readonly string[];
  try {
    args = resolved.adapter.buildArgs(providerRequest);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  for (const part of [...resolved.command, ...args]) {
    deps.stdout.write(`${shorten(part)}\n`);
  }
  return 0;
}

/** The real run: spawn the provider, then optional command hook after a successful execute. */
async function runAndRecord(
  command: CommandDefinition,
  mode: ExecutionMode,
  effectiveTask: string,
  resolved: ReturnType<typeof resolveProvider>,
  providerRequest: ProviderRequest,
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
): Promise<number> {
  const exitCode = await runAgent(
    {
      provider: resolved,
      providerRequest,
      commandName: command.name,
      task: effectiveTask,
      plansDir: join(deps.repoRoot, 'plans'),
      colorize: parsed.colorize,
    },
    { runner: deps.runner, stdout: deps.stdout, stderr: deps.stderr, signals: deps.signals, now: deps.now },
  );

  if (exitCode === 0 && mode === 'execute' && command.afterExecuteSuccess !== undefined) {
    try {
      command.afterExecuteSuccess(deps.repoRoot);
    } catch (error) {
      deps.stderr.write(`${errorMessage(error)}\n`);
      return 1;
    }
  }

  return exitCode;
}

/**
 * Why `phase` is off for the run's project: its `project_switch` is not `true` in the project's
 * config.json. Opt-in on purpose: a phase behind a switch changes what is not the tests' (the
 * application's code), so a project that says nothing keeps it off.
 */
function projectSwitchOff(parsed: RunArgs, deps: RunAgentsCliDeps): (phase: AgentPhase) => string | undefined {
  return (phase) => {
    const project = parsed.project;
    if (phase.projectSwitch === undefined || project === undefined) {
      return undefined;
    }
    const value = readProjectConfig(projectsDir(deps), project)[phase.projectSwitch];
    return value === true ? undefined : `desligada em "${project}" (config.json: ${phase.projectSwitch} precisa ser true)`;
  };
}

/**
 * The runs this command makes: the agent itself, or — for an agent with `phases` — one per phase
 * selected by the phase flags (all of them without one). `undefined` when the selection fails; the
 * reason is already on `stderr`, as is each phase the project turns off.
 */
function resolvePhaseRuns(
  parsed: RunArgs,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): readonly (AgentPhase | undefined)[] | undefined {
  if (agent.phases === undefined) {
    return [undefined];
  }
  try {
    const selection = selectPhases(agent.phases, parsed.phases, projectSwitchOff(parsed, deps));
    for (const { phase, reason } of selection.skipped) {
      deps.stderr.write(`fase ${phase.name} pulada: ${reason}\n`);
    }
    return selection.run;
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

interface PreparedRun {
  readonly effectiveTask: string;
  readonly resolved: ReturnType<typeof resolveProvider>;
  readonly providerRequest: ProviderRequest;
}

/** The common arguments of every run of this command, resolved once before the first one. */
interface RunContext {
  readonly parsed: RunArgs;
  readonly deps: RunAgentsCliDeps;
  readonly agentsDir: string;
  readonly vars: Readonly<Record<string, string>>;
  readonly mode: ExecutionMode;
  readonly task: string;
  readonly planContent: string | undefined;
  /** The command comes from `agent.yaml` (not from code), so each run derives it from its agent. */
  readonly synthesized: boolean;
}

/** One run: its agent (the phase's, for a phase) and command, before the agent's `${…}` are filled in. */
interface RunTarget {
  readonly command: CommandDefinition;
  readonly agent: AgentDefinition;
  /** A later phase of a run that does not execute leaves its `before_execute` out. */
  readonly skipPrepare: boolean;
}

/**
 * The command a run uses once its agent's `${…}` are filled in: one defined in code stays as is; one
 * derived from `agent.yaml` is derived again, so its steps get the filled-in arguments.
 */
function commandFor(context: RunContext, target: RunTarget, agent: AgentDefinition): CommandDefinition {
  const command = context.synthesized ? commandFromAgent(agent) : target.command;
  return target.skipPrepare ? withoutPrepare(command) : command;
}

/** Everything one run needs before its provider starts; `undefined` when a check stops it (reason on `stderr`). */
function prepareRun(context: RunContext, target: RunTarget): (PreparedRun & { command: CommandDefinition }) | undefined {
  const { parsed, deps } = context;
  const agent = expandAgent(target.agent, context.vars, deps);
  if (agent === undefined || !checkModelSupported(parsed, agent, deps)) {
    return undefined;
  }
  const command = commandFor(context, target, agent);
  const agentSkills = resolveAgentSkills(agent, deps);
  const mcpServers = agentSkills === undefined ? undefined : resolveAgentMcps(agent, deps);
  if (agentSkills === undefined || mcpServers === undefined) {
    return undefined;
  }
  const readDirs = [
    context.agentsDir,
    ...(agentSkills.skills.length > 0 ? [agentSkills.skillsDir] : []),
    ...permissionDirs(readAgentPermissions(agent.instructions)),
  ];
  const addDirs = resolveAddDirs(command, parsed, deps, readDirs);
  const resolved = resolveProviderChoice(parsed, deps);
  if (resolved === undefined) {
    return undefined;
  }
  const built = buildProviderRequest(
    command,
    agent,
    context.mode,
    context.task,
    context.planContent,
    addDirs,
    formatSkillsInstruction(agentSkills.skills, deps.repoRoot),
    mcpServers,
    parsed,
    deps,
  );
  return built === undefined ? undefined : { ...built, resolved, command };
}

/** `command` without its `before_execute`: a later phase's steps need the earlier phase to have run for real. */
function withoutPrepare(command: CommandDefinition): CommandDefinition {
  const { prepare: _prepare, ...rest } = command;
  return rest;
}

/**
 * The command and agent of one run: the agent's own for a plain agent; for a phase, the agent in that
 * phase. A later phase of a run that does not execute (`--dry-run`, plan, ask) skips its `before_execute`,
 * which would check work the earlier phase never did.
 */
function runTarget(
  context: RunContext,
  command: CommandDefinition,
  agent: AgentDefinition,
  phase: AgentPhase | undefined,
  index: number,
): RunTarget {
  if (phase === undefined) {
    return { command, agent, skipPrepare: false };
  }
  const phaseAgent = agentInPhase(agent, phase);
  // A phase named after a color (red, green) is shown in it.
  const header = `[${agent.name}: fase ${phase.name}]`;
  const colored = context.parsed.colorize && isAnsiColor(phase.name) ? paint(header, phase.name) : header;
  context.deps.stdout.write(`${colored}\n`);
  const executes = !context.parsed.dryRun && context.mode === 'execute';
  const skipPrepare = index > 0 && !executes && phase.beforeExecute !== undefined;
  if (skipPrepare) {
    context.deps.stdout.write(`(before_execute da fase ${phase.name} só roda depois da fase anterior)\n`);
  }
  return { command: commandFromAgent(phaseAgent), agent: phaseAgent, skipPrepare };
}

async function runCommand(parsed: RunArgs, deps: RunAgentsCliDeps): Promise<number> {
  const agentsDir = resolveAgentsDir(parsed.agentsDir, deps.config, deps.repoRoot);

  const resolvedAgent = await resolveAgentForCommand(parsed, deps, agentsDir);
  if (resolvedAgent === undefined) {
    return 1;
  }
  const { command, agent } = resolvedAgent;

  // A flag this agent does not take (`--project` without `project_required`, `--since` without a
  // `git_diff`, `--type` without `ticket_types`, a phase it does not have…) is an error, even next to
  // `--help`: its own help is exactly the list of flags it takes, so anything outside it would be
  // silently ignored.
  const foreign = foreignFlag(parsed, command, agent, deps);
  if (foreign !== undefined) {
    deps.stderr.write(`${unknownFlagMessage(foreign, agent.name)}\n`);
    return 1;
  }

  // `--help`/`-h` after the command name: show *this* agent's own info and stop — generic for
  // any agent, since it's built entirely from the `AgentDefinition` + `CommandDefinition` just
  // resolved above, nothing hardcoded per agent. No task/provider/mode validation needed past
  // this point, so it's checked before any of that.
  if (parsed.help) {
    deps.stdout.write(`${formatAgentHelp(command, agent, deps)}\n`);
    return 0;
  }

  const projectVars = resolveProjectVars(parsed, agent, deps);
  if (projectVars === undefined) {
    return 1;
  }

  const ticketTarget = resolveRunTicket(parsed, agent, deps);
  if (ticketTarget === null) {
    return 1;
  }

  const phases = resolvePhaseRuns(parsed, agent, deps);
  if (phases === undefined) {
    return 1;
  }

  const taskAndMode = resolveTaskAndMode(parsed, command, deps);
  if (taskAndMode === undefined) {
    return 1;
  }

  const planResult = resolvePlanContent(parsed, deps);
  if (planResult === undefined) {
    return 1;
  }

  const context: RunContext = {
    parsed,
    deps,
    agentsDir,
    vars: { ...projectVars, ...ticketVars(ticketTarget) },
    ...taskAndMode,
    planContent: planResult.planContent,
    synthesized: !deps.commands.some((candidate) => candidate.name === parsed.command),
  };

  let createdContent: string | undefined;
  let exitCode = 0;
  for (const [index, phase] of phases.entries()) {
    const prepared = prepareRun(context, runTarget(context, command, agent, phase, index));
    if (prepared === undefined) {
      exitCode = 1;
      break;
    }
    if (parsed.dryRun) {
      exitCode = runDryRun(prepared.resolved, prepared.providerRequest, deps);
      if (exitCode !== 0) break;
      continue;
    }
    if (index === 0) {
      try {
        createdContent = createPlannedTicket(ticketTarget);
      } catch (error) {
        deps.stderr.write(`${errorMessage(error)}\n`);
        return 1;
      }
    }
    exitCode = await runAndRecord(
      prepared.command,
      context.mode,
      prepared.effectiveTask,
      prepared.resolved,
      prepared.providerRequest,
      parsed,
      deps,
    );
    if (exitCode !== 0) break;
  }
  if (parsed.dryRun) {
    return exitCode;
  }
  return finishTicket(ticketTarget, createdContent, context.mode, exitCode, deps.stderr);
}

export async function runAgentsCli(argv: readonly string[], deps: RunAgentsCliDeps): Promise<number> {
  if (argv[0] === '__complete') {
    return runComplete(argv.slice(1), deps);
  }
  if (argv[0] === '__describe') {
    return runDescribe(argv.slice(1), deps);
  }

  let parsed: ParsedAgentsArgs;
  try {
    parsed = parseAgentsArgs(argv);
  } catch (error) {
    // `parseAgentsArgs` only throws `AgentsArgsError`, shown as is (`unknown flag: …`), without the
    // `Error:` of other failures.
    deps.stderr.write(`${(error as AgentsArgsError).message}\n`);
    return 1;
  }

  if (parsed.kind === 'help') {
    return runHelp(deps);
  }
  if (parsed.kind === 'list') {
    return await runList(parsed, deps);
  }
  return runCommand(parsed, deps);
}
