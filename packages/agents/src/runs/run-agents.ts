import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { formatHelp } from '@choliba/core/cli';
import type { CommandSpec } from '@choliba/core/cli';
import { CHOL_ROOT } from '@choliba/core/config';
import { AppError, ensureApp, type ProjectSettings, type RunningApp } from '@choliba/projects';

import { listAgents } from '../agents/agent-loader';
import { agentCommandSpec, agentsCliSpec } from '../agents/agents.help';
import type { AgentsArgsError, ParsedAgentsArgs } from '../agents/dto/run-agent.dto';
import { parseAgentsArgs, unknownFlagMessage } from '../agents/dto/run-agent.dto';
import type { AgentDefinition } from '../agents/interfaces/agent.interface';
import type { CommandDefinition, ExecutionMode } from '../agents/interfaces/command.interface';
import { resolveAgentsDir } from '../agents/workspace-dirs';
import type { ProviderRequest } from '../providers/interfaces/provider.interface';
import type { ResolvedProvider } from '../providers/provider-registry';
import { formatStepFailure, stepExitCode } from '../steps/actions';
import { formatAgentDetail, runList } from './agent-detail';
import { formatDryRun } from './dry-run';
import { runAgent } from './run-agent';
import { planRunTools } from './run-tools/run-tools';
import {
  foreignFlag,
  resolveAgentForCommand,
  resolvePlanContent,
  resolveProjectVars,
  resolveRunTicket,
  resolveTaskAndMode,
} from './run-checks';
import type { PreparedRun, RunAgentsCliDeps, RunArgs, RunContext } from './run-context';
import { errorMessage, projectsDir } from './run-context';
import { prepareRun } from './run-preparation';
import { specContext } from './spec-context';
import type { TicketTarget } from './ticket-run';
import { createPlannedTicket, finishTicket, ticketVars } from './ticket-run';

export type { RunAgentsCliDeps } from './run-context';

/** `--help`/`-h` after a command name — usage, the agent's detail block, then its options. */
function formatAgentHelp(command: CommandDefinition, agent: AgentDefinition, deps: RunAgentsCliDeps): string {
  return formatHelp(agentCommandSpec(agent, specContext([], deps), formatAgentDetail(command, agent)));
}

/** Global `--help`, listing the agents found in the default agents dir right now. */
function runHelp(deps: RunAgentsCliDeps): number {
  deps.stdout.write(`${formatHelp(agentsHelpSpec(deps))}\n`);
  return 0;
}

/**
 * `--help` and completion of `choliba agents`: its commands, the agents found on disk right now and their
 * flags, with the projects, tickets and git refs their values complete to.
 */
export function agentsHelpSpec(deps: RunAgentsCliDeps): CommandSpec {
  const agents = listAgents(resolveAgentsDir(undefined, deps.config, deps.repoRoot));
  return agentsCliSpec(specContext(agents, deps));
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
  settings: ProjectSettings | undefined,
): number {
  const { resolved, providerRequest } = prepared;
  let args: readonly string[];
  try {
    args = resolved.adapter.buildArgs(providerRequest);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  const workspaceFiles = parsed.showPrompt
    ? [...planRunTools(providerRequest, deps.config), ...(resolved.adapter.previewWorkspace?.(providerRequest) ?? [])]
    : [];
  const output = formatDryRun({
    providerId: resolved.adapter.id,
    command: resolved.command,
    args,
    request: providerRequest,
    newTicket: ticketTarget?.create === undefined ? undefined : ticketTarget.file,
    hasTicket: ticketTarget !== undefined,
    showPrompt: parsed.showPrompt,
    workspaceFiles,
    ...(settings === undefined ? {} : { app: settings.environment }),
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
    deps.stderr.write(`${formatStepFailure(failure)}\n`);
  }
  const [first] = failures;
  if (first !== undefined) {
    // Once, after every failed step, so it does not read as part of the last one's output.
    const blame = exitCode === 0 ? '; quem falhou foram os steps acima' : '';
    deps.stderr.write(`O agente terminou com código ${String(exitCode)}${blame}.\n`);
  }
  return exitCode !== 0 || first === undefined ? exitCode : stepExitCode(first);
}

/** The real run: spawn the provider, then the `after` steps. */
async function runAndRecord(
  command: CommandDefinition,
  mode: ExecutionMode,
  effectiveTask: string,
  resolved: ResolvedProvider,
  providerRequest: ProviderRequest,
  deps: RunAgentsCliDeps,
): Promise<number> {
  const exitCode = await runAgent(
    {
      provider: resolved,
      providerRequest,
      commandName: command.name,
      task: effectiveTask,
      plansDir: join(deps.repoRoot, 'plans'),
      theme: deps.theme,
      toolFiles: planRunTools(providerRequest, deps.config),
    },
    { runner: deps.runner, stdout: deps.stdout, stderr: deps.stderr, signals: deps.signals, now: deps.now },
  );

  return runAfter(command, mode, exitCode, deps);
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

  const projectRun = resolveProjectVars(parsed, agent, deps);
  if (projectRun === undefined) {
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
    vars: { ...projectRun.vars, ...ticketVars(ticketTarget) },
    ...(projectRun.project === undefined ? {} : { project: projectRun.project }),
    ...taskAndMode,
    planContent: planResult.planContent,
    synthesized: !deps.commands.some((candidate) => candidate.name === parsed.command),
  };

  // The application is up before anything that may use it: the `before` steps (tests) and the agent. `--dry-run`
  // only says it would be.
  const app = parsed.dryRun ? NO_APP : await appFor(projectRun.settings, deps);
  if (app === undefined) {
    return 1;
  }
  try {
    return await runPrepared(context, command, agent, ticketTarget, projectRun.settings);
  } finally {
    app.stop();
  }
}

const NO_APP: RunningApp = { started: false, stop: () => undefined };

/**
 * The application of a run with `--project` (`ensureApp`): its setup run, and up at its `baseURL`, started by
 * choliba when it was not. `undefined` when it could not be, with the reason on `stderr`: the agent does not run.
 */
async function appFor(settings: ProjectSettings | undefined, deps: RunAgentsCliDeps): Promise<RunningApp | undefined> {
  if (settings === undefined) {
    return NO_APP;
  }
  const ensure =
    deps.ensureApp ??
    ((project: ProjectSettings) =>
      ensureApp(project, {
        projectsDir: projectsDir(deps),
        logDir: join(deps.repoRoot, '.cache', 'app'),
        env: process.env,
        stderr: deps.stderr,
        spawn: spawnSync,
      }));
  try {
    return await ensure(settings);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    deps.stderr.write(`✗ ${error.message}\n  O agente não foi executado.\n`);
    return undefined;
  }
}

/** From the steps before the agent to the ticket's check after it, with the application already up. */
async function runPrepared(
  context: RunContext,
  command: CommandDefinition,
  agent: AgentDefinition,
  ticketTarget: TicketTarget | undefined,
  settings: ProjectSettings | undefined,
): Promise<number> {
  const { parsed, deps } = context;
  const prepared = prepareRun(context, command, agent);
  if ('exitCode' in prepared) {
    return prepared.exitCode;
  }
  if (parsed.dryRun) {
    return runDryRun(prepared, ticketTarget, parsed, deps, settings);
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
    deps,
  );
  return finishTicket(ticketTarget, createdContent, context.mode, exitCode, deps.stderr);
}

export async function runAgentsCli(argv: readonly string[], deps: RunAgentsCliDeps): Promise<number> {
  let parsed: ParsedAgentsArgs;
  try {
    parsed = parseAgentsArgs(argv, deps.providers);
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
