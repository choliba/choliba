// Everything a run needs before its provider starts, from the agent's variables to the request.

import { dirname, join } from 'node:path';

import {
  CHOL_AGENTS_DIR,
  CHOL_AGENTS_PROVIDER,
  CHOL_GLOBAL_DIR,
  CHOL_MCPS_DIR,
  CHOL_PROJECTS_DIR,
  CHOL_ROOT,
  CHOL_SKILLS_DIR,
  CHOL_TICKET_RUNS,
  RUNS_DIR,
} from '@choliba/core';
import { resolveLocations } from '@choliba/projects';

import { invocationFromAgent, effectivePolicy } from '../invocation';
import type { AgentDefinition } from '../../common';
import type { AgentInvocation, CommandPrepareInput } from '../interfaces/invocation.interface';
import type { ExecutionMode } from '../../common';
import { definedConfig, resolveAgentsDir, resolveMcpsDir, resolveSkillsDir } from '../agent-dirs';
import type { McpServer } from '../../common';
import { resolveMcps } from '../../common';
import type { ProviderRequest } from '../../common';
import type { ResolvedProvider } from '../../common';
import type { SkillSummary } from '../agent-skills';
import { formatSkillsInstruction, resolveSkills } from '../agent-skills';
import { StepFailedError, stepExitCode } from '../steps/step-actions';
import { buildUserPrompt } from '../../common';
import { checkModelSupported, checkedExecuteDirs } from './run-checks';
import type { PreparedRun, RunAgentsCliDeps, RunArgs, RunContext, Stopped } from './run-context';
import { STOPPED, errorMessage, toAbsolute } from './run-context';
import { LOCATION_VARS, agentTexts, withExpandedVars } from '../../common';
import { withProjectDenies } from '../../common';

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

/**
 * Step 4: extra directories the provider may enter — the command's own, `--add-dir`, and the directories
 * `execute` names outside the workspace root (the provider cannot run a command in a folder it may not
 * enter). Entering a folder is not reading it: the providers run with every tool not allowed by a rule
 * denied, so what may be read there comes from `permissions` (`withReads`). Never fails.
 */
function resolveAddDirs(
  command: AgentInvocation,
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
function resolveProviderChoice(parsed: RunArgs, deps: RunAgentsCliDeps): ResolvedProvider | undefined {
  try {
    const providerPreference = deps.providers.parsePreference(parsed.provider ?? deps.config[CHOL_AGENTS_PROVIDER]);
    return deps.providers.resolve(providerPreference, deps.which);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return undefined;
  }
}

/**
 * The prompt body from the command's `prepare` hook (the `before` steps of the mode, or their markers
 * on `--dry-run`) and the task it may have rewritten. A failed step stops the run with the step's own
 * exit code; the message says which step, what it ran and that the agent did not run.
 */
function runPrepare(
  prepare: NonNullable<AgentInvocation['prepare']>,
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
  command: AgentInvocation,
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
 * The command a run uses once its agent's `${…}` are filled in: one defined in code stays as is; one
 * derived from `agent.yaml` is derived again, so its steps get the filled-in arguments.
 */
function commandFor(context: RunContext, command: AgentInvocation, agent: AgentDefinition): AgentInvocation {
  return context.synthesized ? invocationFromAgent(agent) : command;
}

/** The agent with `folders` added to what it may read; what it may not (`deny.read`) still wins. */
function withReads(agent: AgentDefinition, folders: readonly string[]): AgentDefinition {
  return folders.length === 0
    ? agent
    : { ...agent, permissions: { ...agent.permissions, allowRead: [...agent.permissions.allowRead, ...folders] } };
}

/**
 * The folders the agent may read besides its own permissions: each skill it lists (using a skill is reading
 * it) and each `--add-dir` (the person who runs it gives it that folder to read).
 */
function extraReads(skills: readonly SkillSummary[], parsed: RunArgs, deps: RunAgentsCliDeps): readonly string[] {
  return [
    ...skills.map((skill) => `${dirname(skill.path)}/`),
    ...parsed.addDirs.map((dir) => `${toAbsolute(dir, deps.repoRoot).replace(/\/+$/, '')}/`),
  ];
}

/** Everything one run needs before its provider starts; `Stopped` when a check or a step stops it (reason on `stderr`). */
export function prepareRun(
  context: RunContext,
  declaredCommand: AgentInvocation,
  declaredAgent: AgentDefinition,
): (PreparedRun & { command: AgentInvocation }) | Stopped {
  const { parsed, deps } = context;
  const expanded = expandAgent(declaredAgent, context.vars, deps);
  if (expanded === undefined || !checkModelSupported(parsed, expanded, deps)) {
    return STOPPED;
  }
  const agent = withProjectDenies(expanded, context.project);
  const command = commandFor(context, declaredCommand, agent);
  const agentSkills = resolveAgentSkills(agent, deps);
  const mcpServers = agentSkills === undefined ? undefined : resolveAgentMcps(agent, deps);
  if (agentSkills === undefined || mcpServers === undefined) {
    return STOPPED;
  }
  const withSkills = withReads(agent, extraReads(agentSkills.skills, parsed, deps));
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
  if ('exitCode' in built) {
    return built;
  }
  const { project } = context;
  const providerRequest = project === undefined ? built.providerRequest : { ...built.providerRequest, project };
  return { ...built, providerRequest, resolved, command };
}
