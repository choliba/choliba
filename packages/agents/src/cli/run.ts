import { dirname, isAbsolute, join } from 'node:path';

import type { ProcessRunner, SignalSource, Writable } from '@choliba/terminal';
import { complete, describe, formatHelp, formatSuggestions } from '@choliba/core/cli';
import type { GitRunner } from '@choliba/core/git';
import { createSpawnGitRunner } from '@choliba/core/git';

import type { AgentDefinition } from '../agent.types';
import { listAgents, loadAgent } from '../agent-loader';
import { resolveCommand } from '../command-registry';
import { commandFromAgent, effectivePolicy } from '../define-command';
import type { CommandDefinition, CommandPrepareInput, ExecutionMode } from '../command.types';
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
import {
  CHOL_AGENTS_DIR,
  CHOL_AGENTS_PROVIDER,
  CHOL_GLOBAL_DIR,
  CHOL_MCPS_DIR,
  CHOL_ROOT,
  CHOL_SKILLS_DIR,
  CHOL_PROJECTS_DIR,
  RUNS_DIR,
  CHOL_TICKET_RUNS,
} from '@choliba/core/config';
import { listProjectNames, listTicketKeys, loadProjectSettings, resolveLocations } from '@choliba/projects';
import { definedConfig, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '../workspace-dirs';
import { absolutePermissions, canRead, outsideExecuteDirs } from '../permissions';
import { formatStepFailure, StepFailedError, stepExitCode } from '../prepare/actions';
import { LOCATION_VARS, agentTexts, withExpandedVars } from '../vars';
import { formatDryRun } from './dry-run';
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
  /** Where each run's empty folder is made (`ProviderRequest.runDir`); defaults to `<repoRoot>/.cache/runs`. */
  readonly runsDir?: string;
}

function toAbsolute(path: string, repoRoot: string): string {
  return isAbsolute(path) ? path : join(repoRoot, path);
}

function errorMessage(error: unknown): string {
  return String(error);
}

const HELP_WIDTH = 80;

/** Greedy word-wrap: never breaks a word, never exceeds `width` unless a single word already does. */
function wrapText(text: string, width: number): readonly string[] {
  const words = text.split(/\s+/).filter((word) => word !== '');
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
    formatYamlList('models', agent.supportedModels),
    formatYamlList(
      'skills',
      agent.skills.map((skill) => skill.name),
    ),
    formatYamlList('modes', agent.modes),
    ...(agent.ticketTypes === undefined ? [] : [formatYamlList('ticket_types', agent.ticketTypes)]),
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
  return resolveLocations(deps.repoRoot, deps.config, () => undefined).CHOL_PROJECTS_DIR;
}

/** The projects `--project` completes to; none when the locations are not configured or the folder is missing. */
function projectNames(deps: RunAgentsCliDeps): readonly string[] {
  try {
    return listProjectNames(projectsDir(deps));
  } catch {
    return [];
  }
}

/**
 * The ticket keys `--ticket` completes to: those of `project` when one was typed (none when it is not a
 * project), else those of every project; none when the projects are not reachable.
 */
function ticketKeys(deps: RunAgentsCliDeps, project: string | undefined): readonly string[] {
  try {
    const dir = projectsDir(deps);
    const names = listProjectNames(dir);
    const projects = project === undefined ? names : names.filter((name) => name === project);
    return projects.flatMap((name) => listTicketKeys(dir, name));
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
    tickets: (project) => ticketKeys(deps, project),
  };
}

/** `--help`/`-h` after a command name — usage, the agent's detail block, then its options. */
function formatAgentHelp(command: CommandDefinition, agent: AgentDefinition, deps: RunAgentsCliDeps): string {
  return formatHelp(agentCommandSpec(agent, specContext([], deps), formatAgentDetail(command, agent)));
}

/** Global `--help`, listing the agents found in the default agents dir right now. */
function runHelp(deps: RunAgentsCliDeps): number {
  const agents = listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  deps.stdout.write(`${formatHelp(agentsCliSpec(specContext(agents, deps)))}\n`);
  return 0;
}

/** `agents __describe <words...>`: one line describing what the words select, read by `bun chol:help`. */
function runDescribe(words: readonly string[], deps: RunAgentsCliDeps): number {
  const agents = listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  deps.stdout.write(`${describe(agentsCliSpec(specContext(agents, deps)), words)}\n`);
  return 0;
}

/** `agents __complete <words...>`: one suggestion per line, read by scripts/libs/chol-completion.bash. */
function runComplete(words: readonly string[], deps: RunAgentsCliDeps): number {
  const agents = listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  const output = formatSuggestions(complete(agentsCliSpec(specContext(agents, deps)), words));
  if (output !== '') {
    deps.stdout.write(`${output}\n`);
  }
  return 0;
}

function runList(kind: Extract<ParsedAgentsArgs, { kind: 'list' }>, deps: RunAgentsCliDeps): number {
  const agentsDir = resolveAgentsDir(kind.agentsDir, deps.config, deps.repoRoot);
  const agents = listAgents(agentsDir);
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
function resolveAgentForCommand(
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
  agentsDir: string,
): { command: CommandDefinition; agent: AgentDefinition } | undefined {
  let command: CommandDefinition | undefined;
  try {
    command = resolveCommand(parsed.command, deps.commands, agentsDir);
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
    const agent = loadAgent(agentsDir, command.agent);
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
 * Pre-flight: when `--model` is explicit, it must be one `agent.yaml#models` actually
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

/** The variables that name the projects' locations, resolved only when the agent uses one. */
const LOCATION_VAR = new RegExp(`\\$\\{(${LOCATION_VARS.join('|')})\\}`);

/**
 * The folders an agent's `agent.yaml` may name, so it never depends on the workspace
 * layout, each under the same name as in `.env`: `${CHOL_ROOT}` (the workspace root, always found by the
 * application), `${CHOL_AGENTS_DIR}`, `${CHOL_SKILLS_DIR}` and `${CHOL_MCPS_DIR}` always;
 * `${CHOL_GLOBAL_DIR}`, `${CHOL_PROJECTS_DIR}` and `${CHOL_TICKET_RUNS}` once CHOL_GLOBAL_DIR is configured;
 * `${PROJECT}`/`${PROJECT_DIR}`/`${APP_DIR}` (the active environment's application code) when the run has
 * a project — all from `@choliba/projects` and `workspace-dirs`, this CLI works out no path itself.
 */
function locationVars(
  deps: RunAgentsCliDeps,
  projectVars: Readonly<Record<string, string>>,
  agent: AgentDefinition,
): Readonly<Record<string, string>> {
  // Resolved only when used: an agent naming none of them runs without CHOL_GLOBAL_DIR, and one that does
  // gets the clear "CHOL_GLOBAL_DIR não definida" instead of a missing variable.
  const locations = agentTexts(agent).some((text) => LOCATION_VAR.test(text))
    ? resolveLocations(deps.repoRoot, deps.config, () => undefined)
    : undefined;
  return {
    [CHOL_ROOT]: deps.repoRoot,
    [CHOL_AGENTS_DIR]: resolveAgentsDir(undefined, deps.config, deps.repoRoot),
    [CHOL_SKILLS_DIR]: resolveSkillsDir(deps.config, deps.repoRoot),
    [CHOL_MCPS_DIR]: resolveMcpsDir(deps.config, deps.repoRoot),
    ...(locations === undefined
      ? {}
      : {
          [CHOL_GLOBAL_DIR]: locations.CHOL_GLOBAL_DIR,
          [CHOL_PROJECTS_DIR]: locations.CHOL_PROJECTS_DIR,
          ...(locations.CHOL_TICKET_RUNS === undefined ? {} : { [CHOL_TICKET_RUNS]: locations.CHOL_TICKET_RUNS }),
        }),
    ...projectVars,
  };
}

/**
 * Pre-flight for `--project`: required when the agent acts on a project (it uses a project variable
 * or declares `ticket_types`, see `AgentDefinition.projectRequired`), and, when given,
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
    deps.stderr.write(
      `Project is required for "${agent.name}" (it uses a project variable or ticket_types): pass --project <name>. ${USAGE}\n`,
    );
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
function resolveRunTicket(
  parsed: RunArgs,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): TicketTarget | undefined | null {
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
    return withExpandedVars(agent, () => locationVars(deps, projectVars, agent));
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/** Step 2: the effective mode and task text, after the `modes.allow`/`--plan-from`/`taskRequired` checks. */
function resolveTaskAndMode(
  parsed: RunArgs,
  command: CommandDefinition,
  agent: AgentDefinition,
  deps: RunAgentsCliDeps,
): { mode: ExecutionMode; task: string } | undefined {
  const mode: ExecutionMode = parsed.mode ?? command.defaultMode;
  if (!agent.modes.includes(mode)) {
    deps.stderr.write(
      `Mode "${mode}" is not allowed for "${agent.name}" (modes.allow: ${agent.modes.join(', ')}). ${USAGE}\n`,
    );
    return undefined;
  }
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

/**
 * Step 4: extra directories the provider may enter — the command's own, `--add-dir`, and the directories
 * `execute` names outside the workspace root (the provider cannot run a command in a folder it may not
 * enter). The agent's own and its skills' folders are not among them: those are granted by rules only,
 * since an added folder is one the provider reads freely. Never fails.
 */
function resolveAddDirs(
  command: CommandDefinition,
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
  executeDirs: readonly string[],
): string[] {
  return [
    ...command.addDirs.map((dir) => toAbsolute(dir, deps.repoRoot)),
    ...parsed.addDirs.map((dir) => toAbsolute(dir, deps.repoRoot)),
    ...executeDirs,
  ];
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

/** A run that stopped before the agent, and the exit code it ends with (the reason is already on `stderr`). */
interface Stopped {
  readonly exitCode: number;
}

const STOPPED: Stopped = { exitCode: 1 };

/**
 * The prompt body from the command's `prepare` hook (the `before` steps of the mode, or their markers
 * on `--dry-run`) and the task it may have rewritten. A failed step stops the run with the step's own
 * exit code; the message says which step, what it ran and that the agent did not run.
 */
function runPrepare(
  prepare: NonNullable<CommandDefinition['prepare']>,
  input: CommandPrepareInput,
  deps: RunAgentsCliDeps,
): { templateOutput: string; effectiveTask: string } | Stopped {
  try {
    const prepared = prepare(input);
    return { templateOutput: prepared.promptBody, effectiveTask: prepared.task };
  } catch (error) {
    if (error instanceof StepFailedError) {
      deps.stderr.write(`${error.message}\n  O agente não foi executado.\n`);
      return { exitCode: stepExitCode(error.failure) };
    }
    deps.stderr.write(`${errorMessage(error)}\n`);
    return STOPPED;
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
): { effectiveTask: string; providerRequest: ProviderRequest } | Stopped {
  const base = { task, repoRoot: deps.repoRoot, agent, mode, dryRun: parsed.dryRun };
  const prompted =
    command.prepare === undefined
      ? { templateOutput: command.prompt({ task, repoRoot: deps.repoRoot, agent }), effectiveTask: task }
      : runPrepare(command.prepare, parsed.since === undefined ? base : { ...base, since: parsed.since }, deps);
  if ('exitCode' in prompted) {
    return prompted;
  }
  const { templateOutput, effectiveTask } = prompted;

  const providerRequest: ProviderRequest = {
    agent,
    mode,
    policy: effectivePolicy(command, mode),
    userPrompt: buildUserPrompt({ templateOutput, mode, planContent }),
    workspaceRoot: deps.repoRoot,
    runDir: join(
      deps.runsDir ?? join(deps.repoRoot, RUNS_DIR),
      `${deps.now().toISOString().replaceAll(':', '-')}-${String(process.pid)}`,
    ),
    addDirs: [...addDirs],
    model: parsed.model,
    ...(skillsInstruction === '' ? {} : { skillsInstruction }),
    ...(mcpServers.length === 0 ? {} : { mcpServers }),
  };
  return { effectiveTask, providerRequest };
}

/**
 * `--dry-run`: what this command line would do without it, in order (`formatDryRun`). Nothing runs
 * and nothing is written: no step, no ticket, no run folder, no provider.
 */
function runDryRun(
  prepared: PreparedRun,
  ticketTarget: TicketTarget | undefined,
  parsed: RunArgs,
  deps: RunAgentsCliDeps,
): number {
  const { resolved, providerRequest } = prepared;
  let args: readonly string[];
  try {
    args = resolved.adapter.buildArgs(providerRequest);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  const workspaceFiles = parsed.showPrompt ? (resolved.adapter.previewWorkspace?.(providerRequest) ?? []) : [];
  const output = formatDryRun({
    providerId: resolved.adapter.id,
    command: resolved.command,
    args,
    request: providerRequest,
    newTicket: ticketTarget?.create === undefined ? undefined : ticketTarget.file,
    hasTicket: ticketTarget !== undefined,
    showPrompt: parsed.showPrompt,
    workspaceFiles,
  });
  deps.stdout.write(`${output}\n`);
  return 0;
}

/**
 * The steps that run after the agent (`CommandDefinition.after`), whatever the mode and however it
 * ended. Each failed step is reported; the run ends with the agent's exit code when the agent
 * failed, else with the first failed step's.
 */
function runAfter(command: CommandDefinition, mode: ExecutionMode, exitCode: number, deps: RunAgentsCliDeps): number {
  const failures = command.after?.({ repoRoot: deps.repoRoot, mode, exitCode }) ?? [];
  for (const failure of failures) {
    deps.stderr.write(`${formatStepFailure(failure)}\n  O agente terminou com código ${String(exitCode)}.\n`);
  }
  const [first] = failures;
  return exitCode !== 0 || first === undefined ? exitCode : stepExitCode(first);
}

/** The real run: spawn the provider, then the `after` steps. */
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

  return runAfter(command, mode, exitCode, deps);
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

/**
 * The command a run uses once its agent's `${…}` are filled in: one defined in code stays as is; one
 * derived from `agent.yaml` is derived again, so its steps get the filled-in arguments.
 */
function commandFor(context: RunContext, command: CommandDefinition, agent: AgentDefinition): CommandDefinition {
  return context.synthesized ? commandFromAgent(agent) : command;
}

/** The agent with the folder of each skill it lists added to what it may read: using a skill is reading it. */
function withSkillReads(agent: AgentDefinition, skills: readonly SkillSummary[]): AgentDefinition {
  const folders = skills.map((skill) => `${dirname(skill.path)}/`);
  return folders.length === 0
    ? agent
    : { ...agent, permissions: { ...agent.permissions, allowRead: [...agent.permissions.allowRead, ...folders] } };
}

/**
 * The directories `execute` names outside the workspace root, each of which must be readable: a command
 * run in a folder reaches what is in it anyway, and a provider can only enter a folder it may read freely.
 * `undefined` when one is not; the reason is already on `stderr`.
 */
function checkedExecuteDirs(agent: AgentDefinition, deps: RunAgentsCliDeps): readonly string[] | undefined {
  const permissions = absolutePermissions(agent.permissions, deps.repoRoot);
  const dirs = outsideExecuteDirs(permissions, deps.repoRoot);
  const unreadable = dirs.filter((dir) => !canRead(permissions, dir));
  if (unreadable.length === 0) {
    return dirs;
  }
  deps.stderr.write(
    `"${agent.name}" runs commands in ${unreadable.join(', ')}, which permissions.allow.read does not cover: ` +
      'add the folder to allow.read (running commands in it reaches what is there anyway).\n',
  );
  return undefined;
}

/** Everything one run needs before its provider starts; `Stopped` when a check or a step stops it (reason on `stderr`). */
function prepareRun(
  context: RunContext,
  declaredCommand: CommandDefinition,
  declaredAgent: AgentDefinition,
): (PreparedRun & { command: CommandDefinition }) | Stopped {
  const { parsed, deps } = context;
  const agent = expandAgent(declaredAgent, context.vars, deps);
  if (agent === undefined || !checkModelSupported(parsed, agent, deps)) {
    return STOPPED;
  }
  const command = commandFor(context, declaredCommand, agent);
  const agentSkills = resolveAgentSkills(agent, deps);
  const mcpServers = agentSkills === undefined ? undefined : resolveAgentMcps(agent, deps);
  if (agentSkills === undefined || mcpServers === undefined) {
    return STOPPED;
  }
  const withSkills = withSkillReads(agent, agentSkills.skills);
  const executeDirs = checkedExecuteDirs(withSkills, deps);
  if (executeDirs === undefined) {
    return STOPPED;
  }
  const addDirs = resolveAddDirs(command, parsed, deps, executeDirs);
  const resolved = resolveProviderChoice(parsed, deps);
  if (resolved === undefined) {
    return STOPPED;
  }
  const built = buildProviderRequest(
    command,
    withSkills,
    context.mode,
    context.task,
    context.planContent,
    addDirs,
    formatSkillsInstruction(agentSkills.skills, deps.repoRoot),
    mcpServers,
    parsed,
    deps,
  );
  return 'exitCode' in built ? built : { ...built, resolved, command };
}

async function runCommand(parsed: RunArgs, deps: RunAgentsCliDeps): Promise<number> {
  if (deps.config[CHOL_ROOT] !== undefined) {
    deps.stderr.write(
      `${CHOL_ROOT} is found by the application (the folder whose package.json depends on choliba) and cannot be set: remove it from .env and from the environment.\n`,
    );
    return 1;
  }
  const agentsDir = resolveAgentsDir(parsed.agentsDir, deps.config, deps.repoRoot);

  const resolvedAgent = resolveAgentForCommand(parsed, deps, agentsDir);
  if (resolvedAgent === undefined) {
    return 1;
  }
  const { command, agent } = resolvedAgent;

  // A flag this agent does not take (`--project` for an agent without a project, `--since` without a
  // `git_diff`, `--type` without `ticket_types`, a mode it does not allow…) is an error, even next to
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

  const taskAndMode = resolveTaskAndMode(parsed, command, agent, deps);
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

  const prepared = prepareRun(context, command, agent);
  if ('exitCode' in prepared) {
    return prepared.exitCode;
  }
  if (parsed.dryRun) {
    return runDryRun(prepared, ticketTarget, parsed, deps);
  }
  let createdContent: string | undefined;
  try {
    createdContent = createPlannedTicket(ticketTarget);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  const exitCode = await runAndRecord(
    prepared.command,
    context.mode,
    prepared.effectiveTask,
    prepared.resolved,
    prepared.providerRequest,
    parsed,
    deps,
  );
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
    return runList(parsed, deps);
  }
  return runCommand(parsed, deps);
}
