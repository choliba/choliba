import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { formatHelp, type CommandSpec, CHOL_ROOT } from '@choliba/core';
import { AppError, ensureApp, type ProjectSettings, type RunningApp } from '@choliba/projects';

import { listAgents } from '../agent-loader';
import { agentCommandSpec, agentsCliSpec } from './agents-spec';
import type { AgentsArgsError, ParsedAgentsArgs } from './agents-flags';
import { parseAgentsArgs, unknownFlagMessage } from './agents-flags';
import type { AgentDefinition } from '../../common';
import type { AgentInvocation } from '../interfaces/invocation.interface';
import type { ExecutionMode } from '../../common';
import { resolveAgentsDir } from '../agent-dirs';
import type { ProviderRequest } from '../../common';
import type { ResolvedProvider } from '../../common';
import { formatStepFailure, stepExitCode } from '../steps/step-actions';
import { formatAgentDetail, runList } from './agent-detail';
import { formatDryRun } from './dry-run';
import { runAgent } from './run-agent';
import { planRunTools, readSandbox, type PlannedFile, type Sandbox, type SandboxConfigError } from '../../common';
import { launchFor, realDisk, type LaunchDisk } from './sandbox-launch';
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
function formatAgentHelp(command: AgentInvocation, agent: AgentDefinition, deps: RunAgentsCliDeps): string {
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
  sandbox: Sandbox,
): number {
  const { resolved, providerRequest } = prepared;
  let args: readonly string[];
  try {
    args = resolved.adapter.buildArgs(providerRequest);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  const runFiles = [
    ...planRunTools(providerRequest, deps.config),
    ...(resolved.adapter.previewWorkspace?.(providerRequest) ?? []),
  ];
  const workspaceFiles = parsed.showPrompt ? runFiles : [];
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
    ...(sandbox.kind === 'docker'
      ? {
          container: {
            image: sandbox.image,
            mounts: launchFor(
              { sandbox, command: resolved.command, request: providerRequest, files: runFiles, config: deps.config },
              plannedDisk(providerRequest, runFiles),
            ).mounts,
          },
        }
      : {}),
  });
  deps.stdout.write(`${output}\n`);
  return 0;
}

/**
 * The disk as a run would leave it before the provider starts, for `--dry-run`, which writes nothing: the run folder
 * and the files planned next to it exist, and no folder is created. It shows the mounts, not the container's user.
 */
function plannedDisk(request: ProviderRequest, files: readonly PlannedFile[]): LaunchDisk {
  const planned = new Set(files.map((file) => file.path));
  return {
    ...realDisk,
    exists: (path) => path === request.runDir || planned.has(path) || realDisk.exists(path),
    isDirectory: (path) => path === request.runDir || (!planned.has(path) && realDisk.isDirectory(path)),
    ensureDir: () => undefined,
    owner: () => ({ uid: 0, gid: 0 }),
  };
}

/** `CHOL_SANDBOX`, checked before anything runs: a value it does not take, or `docker` without Docker, stops here. */
function sandboxFor(deps: RunAgentsCliDeps): Sandbox | undefined {
  let sandbox: Sandbox;
  try {
    sandbox = readSandbox(deps.config);
  } catch (error) {
    // `readSandbox` only throws `SandboxConfigError`, shown as is.
    deps.stderr.write(`${(error as SandboxConfigError).message}\n`);
    return undefined;
  }
  if (sandbox.kind === 'docker' && deps.which('docker') === null) {
    deps.stderr.write('CHOL_SANDBOX=docker, mas o comando docker não foi encontrado: instale o Docker ou use local.\n');
    return undefined;
  }
  return sandbox;
}

/**
 * The steps that run after the agent (`AgentInvocation.after`), whatever the mode and however it
 * ended. Each failed step is reported; the run ends with the agent's exit code when the agent
 * failed, else with the first failed step's.
 */
function runAfter(command: AgentInvocation, mode: ExecutionMode, exitCode: number, deps: RunAgentsCliDeps): number {
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
  command: AgentInvocation,
  mode: ExecutionMode,
  effectiveTask: string,
  resolved: ResolvedProvider,
  providerRequest: ProviderRequest,
  deps: RunAgentsCliDeps,
  sandbox: Sandbox,
): Promise<number> {
  const toolFiles = planRunTools(providerRequest, deps.config);
  const files = [...toolFiles, ...(resolved.adapter.previewWorkspace?.(providerRequest) ?? [])];
  const exitCode = await runAgent(
    {
      provider: resolved,
      providerRequest,
      commandName: command.name,
      task: effectiveTask,
      plansDir: join(deps.repoRoot, 'plans'),
      theme: deps.theme,
      toolFiles,
      launch: (providerCommand) =>
        launchFor({ sandbox, command: providerCommand, request: providerRequest, files, config: deps.config }),
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
  // any agent, since it's built entirely from the `AgentDefinition` + `AgentInvocation` just
  // resolved above, nothing hardcoded per agent. No task/provider/mode validation needed past
  // this point, so it's checked before any of that.
  if (parsed.help) {
    deps.stdout.write(`${formatAgentHelp(command, agent, deps)}\n`);
    return 0;
  }

  const sandbox = sandboxFor(deps);
  if (sandbox === undefined) {
    return 1;
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
    return await runPrepared(context, command, agent, ticketTarget, projectRun.settings, sandbox);
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
  command: AgentInvocation,
  agent: AgentDefinition,
  ticketTarget: TicketTarget | undefined,
  settings: ProjectSettings | undefined,
  sandbox: Sandbox,
): Promise<number> {
  const { parsed, deps } = context;
  const prepared = prepareRun(context, command, agent);
  if ('exitCode' in prepared) {
    return prepared.exitCode;
  }
  if (parsed.dryRun) {
    return runDryRun(prepared, ticketTarget, parsed, deps, settings, sandbox);
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
    sandbox,
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
