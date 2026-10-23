import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { formatDuration, wantsFooter } from '@choliba/shell';
import { openOpenTuiPanel } from '@choliba/tui';
import type { ProjectSettings } from '@choliba/domain';
import { AppError, ensureApp, shareApp, type RunningApp } from '@choliba/runner';
import { readSandbox, type Sandbox, type SandboxConfigError } from '@choliba/sandbox';

import type { AgentsArgsError, ParsedAgentsArgs, ParsedListArgs } from './agents-flags';
import { parseAgentsArgs, parseListArgs, unknownFlagMessage } from './agents-flags';
import type { AgentDefinition } from '../../common';
import type { AgentInvocation } from '../interfaces/invocation.interface';
import type { ExecutionMode } from '../../common';
import { APP_LOGS_DIR, LOGS_DIR, resolveAgentsDir } from '@choliba/workspace';
import type { ProviderRequest } from '../../common';
import type { ResolvedProvider } from '../../common';
import { runAfter, spawnToEnd } from '@choliba/engine';
import { runList } from './agent-detail';
import { formatDryRun, modelText, type DryRunInput } from './dry-run';
import { runAgent } from './run-agent';
import { createRunScreen } from './run-screen';
import { loggedStream, NO_RUN_LOG, openRunLog, type RunLog } from './run-log';
import { planRunTools, type PlannedFile } from '../../common';
import { CHOL_ROOT } from '../../common';
import { containerReachProblem } from './app-reach';
import { launchFor, realDisk, type Launch, type LaunchDisk } from './sandbox-launch';
import {
  acceptedFlagNames,
  foreignFlag,
  resolveAgentForCommand,
  resolvePlanContent,
  resolveProjectVars,
  resolveRunTicket,
  resolveTaskAndMode,
} from './run-checks';
import type { PreparedRun, RunAgentsCliDeps, RunArgs, RunContext } from './run-context';
import { errorMessage, projectsDir } from './run-context';
import { definitionChangeReport, definitionChanges, definitionSnapshot } from './definition-snapshot';
import { definitionDirectories, prepareRun } from './run-preparation';
import type { TicketTarget } from './ticket-run';
import { createPlannedTicket, finishTicket, ticketVars } from './ticket-run';

export type { RunAgentsCliDeps } from './run-context';

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
  let described: Pick<DryRunInput, 'container' | 'local'>;
  try {
    described = sandboxView(
      sandbox,
      launchFor(
        {
          sandbox,
          command: resolved.command,
          provider: resolved,
          request: providerRequest,
          files: runFiles,
          config: deps.config,
        },
        plannedDisk(providerRequest, runFiles),
      ),
    );
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  const input: DryRunInput = {
    // Said when the agent's models chose it, so the reader sees why it is not the environment's.
    providerId: resolved.adapter.id,
    command: resolved.command,
    args,
    request: providerRequest,
    newTicket: ticketTarget?.create === undefined ? undefined : ticketTarget.file,
    hasTicket: ticketTarget !== undefined,
    showPrompt: parsed.showPrompt,
    workspaceFiles,
    ...(settings === undefined ? {} : { app: settings.environment }),
    ...described,
  };
  if (deps.preview === undefined) deps.stdout.write(`${formatDryRun(input)}\n`);
  else deps.preview(input);
  return 0;
}

/** What `--dry-run` says about where the provider runs: the container, or `bwrap` on this machine. */
function sandboxView(sandbox: Sandbox, launch: Launch): Pick<DryRunInput, 'container' | 'local'> {
  if (sandbox.kind === 'docker') return { container: containerOf(sandbox.image, sandbox.network, launch) };
  return { local: { mounts: launch.paths, skipped: launch.skipped } };
}

/** What `--dry-run` says about the container: the image, the mounts and the paths left to the image. */
function containerOf(
  image: string,
  network: 'isolated' | 'host',
  launch: Launch,
): NonNullable<DryRunInput['container']> {
  return { image, network, mounts: launch.paths, skipped: launch.skipped };
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
    link: () => undefined,
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
    deps.stderr.write(
      'O sandbox docker precisa do comando docker, que não foi encontrado: instale o Docker ou use local.\n',
    );
    return undefined;
  }
  return sandbox;
}

/**
 * The steps that run after the agent (`AgentInvocation.after`), whatever the mode and however it
 * ended. Each failed step is reported; the run ends with the agent's exit code when the agent
 * failed, else with the first failed step's.
 */
/** The real run: spawn the provider, then the `after` steps. */
async function runAndRecord(
  command: AgentInvocation,
  mode: ExecutionMode,
  effectiveTask: string,
  resolved: ResolvedProvider,
  providerRequest: ProviderRequest,
  deps: RunAgentsCliDeps,
  sandbox: Sandbox,
  project: string | undefined,
  log: RunContext['log'],
): Promise<number> {
  const toolFiles = planRunTools(providerRequest, deps.config);
  const files = [...toolFiles, ...(resolved.adapter.previewWorkspace?.(providerRequest) ?? [])];
  let answer: string | undefined;
  log.log.write('choliba', `provider ${resolved.adapter.id} · modelo ${modelText(providerRequest.model)}`);
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
        launchFor({
          sandbox,
          command: providerCommand,
          provider: resolved,
          request: providerRequest,
          files,
          config: deps.config,
        }),
    },
    {
      runner: deps.runner,
      // The run's screen logs what it writes itself, so it gets the streams as they were before the log.
      stdout: log.stdout,
      stderr: log.stderr,
      log: log.log,
      signals: deps.signals,
      now: deps.now,
      screen: (info, request, hostedPanel) =>
        createRunScreen(info, request, {
          stdout: log.stdout,
          stderr: log.stderr,
          now: deps.now,
          footer: wantsFooter(deps.stdout, deps.config),
          panel: deps.panel ?? openOpenTuiPanel,
          hostedPanel,
        }),
      hostedPanel: deps.hostedPanel === true,
      answered: (text) => {
        answer = text;
      },
    },
  );

  return runAfter(
    command,
    { mode, exitCode, answer },
    {
      repoRoot: deps.repoRoot,
      stderr: deps.stderr,
      ...(deps.signal === undefined ? {} : { signal: deps.signal }),
      ...(project === undefined ? {} : { project: { projectsDir: projectsDir(deps), name: project } }),
    },
  );
}

/** The run's deps with `--sandbox` in place of `CHOL_SANDBOX`, so everything after it sees one sandbox. */
function withSandbox(parsed: RunArgs, deps: RunAgentsCliDeps): RunAgentsCliDeps {
  return parsed.sandbox === undefined ? deps : { ...deps, config: { ...deps.config, CHOL_SANDBOX: parsed.sandbox } };
}

async function runCommand(parsed: RunArgs, given: RunAgentsCliDeps): Promise<number> {
  const deps = withSandbox(parsed, given);
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
    deps.stderr.write(`${unknownFlagMessage(foreign, agent.name, acceptedFlagNames(command, agent, deps))}\n`);
    return 1;
  }

  // `--help`/`-h` after the command name: show *this* agent's own info and stop — generic for
  // any agent, since it's built entirely from the `AgentDefinition` + `AgentInvocation` just
  // resolved above, nothing hardcoded per agent. No task/provider/mode validation needed past
  // this point, so it's checked before any of that.
  if (parsed.help) {
    deps.help?.agent(command, agent);
    return 0;
  }

  const sandbox = sandboxFor(deps);
  if (sandbox === undefined) {
    return 1;
  }

  const projectRun = resolveProjectVars(parsed, agent, deps, sandbox);
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
    sandbox,
    vars: { ...projectRun.vars, ...ticketVars(ticketTarget) },
    ...(projectRun.project === undefined ? {} : { project: projectRun.project }),
    ...taskAndMode,
    planContent: planResult.planContent,
    synthesized: !deps.commands.some((candidate) => candidate.name === parsed.command),
    log: { log: NO_RUN_LOG, stdout: deps.stdout, stderr: deps.stderr },
  };

  // From here on, a real run writes its log as it goes: the application, the steps, the agent and how it ended.
  const logged = parsed.dryRun ? undefined : withRunLog(context, agent);
  const runContext = logged === undefined ? context : { ...context, deps: logged.deps, log: logged.run };
  // The application is up before anything that may use it: the `before` steps (tests) and the agent. `--dry-run`
  // only says it would be.
  // What the application's setup and start say is progress, logged as choliba's; only a failure is an error.
  const progress = logged === undefined ? runContext.deps.stderr : loggedStream(logged.stderr, logged.log, 'choliba');
  const app = parsed.dryRun ? NO_APP : await appFor(projectRun.settings, runContext.deps, progress);
  if (app === undefined) {
    return closeRunLog(logged, 1);
  }
  const unreachable =
    projectRun.settings === undefined || parsed.dryRun
      ? undefined
      : await containerReachProblem(projectRun.settings.environment.baseURL, sandbox, deps.appReach);
  if (unreachable !== undefined) {
    app.stop();
    runContext.deps.stderr.write(`✗ ${unreachable}\n  O agente não foi executado.\n`);
    return closeRunLog(logged, 1);
  }
  try {
    const exitCode = await runPrepared(runContext, command, agent, ticketTarget, projectRun.settings, sandbox);
    return closeRunLog(logged, exitCode);
  } finally {
    app.stop();
  }
}

/** A run's log, open, and the deps that write to it: what goes to `stdout` and `stderr` is logged too. */
interface LoggedRun {
  readonly log: RunLog;
  readonly run: RunContext['log'];
  readonly deps: RunAgentsCliDeps;
  readonly started: number;
  readonly stderr: RunAgentsCliDeps['stderr'];
}

/** What the log says first: the agent, the mode, the project, the ticket, the sandbox and the task. */
function runLogHeader(context: RunContext, agent: AgentDefinition): readonly string[] {
  return [
    `choliba run agent ${agent.name} ${agent.version}`,
    `modo: ${context.mode}`,
    `projeto: ${context.project?.name ?? '—'}`,
    `ticket: ${context.vars['TICKET'] ?? '—'}`,
    `sandbox: ${context.sandbox.kind}`,
    `tarefa: ${context.task}`,
  ];
}

/** Opens the log of the run, in `.cache/logs/<agent>/`, and gives the deps whose `stdout` and `stderr` write to it. */
function withRunLog(context: RunContext, agent: AgentDefinition): LoggedRun {
  const { deps } = context;
  const dir = deps.logsDir ?? join(deps.repoRoot, LOGS_DIR);
  const log = openRunLog(dir, agent.name, runLogHeader(context, agent), deps.now);
  return {
    log,
    run: { log, stdout: deps.stdout, stderr: deps.stderr },
    started: deps.now().getTime(),
    stderr: deps.stderr,
    deps: {
      ...deps,
      stdout: loggedStream(deps.stdout, log, 'saida'),
      stderr: loggedStream(deps.stderr, log, 'erro'),
    },
  };
}

/** Ends the log with the run's code and how long it took, says where it is, and gives the code back. */
function closeRunLog(logged: LoggedRun | undefined, exitCode: number): number {
  if (logged === undefined) return exitCode;
  const took = formatDuration(logged.deps.now().getTime() - logged.started);
  logged.log.write('choliba', `fim: código ${String(exitCode)} · tempo total ${took}`);
  logged.stderr.write(`log em ${logged.log.path}\n`);
  return exitCode;
}

const NO_APP: RunningApp = { started: false, stop: () => undefined };

/**
 * The application of a run with `--project` (`ensureApp`): its setup run, and up at its `baseURL`, started by
 * choliba when it was not, saying so on `progress`. `undefined` when it could not be, with the reason on `stderr`: the
 * agent does not run.
 */
async function appFor(
  settings: ProjectSettings | undefined,
  deps: RunAgentsCliDeps,
  progress: RunAgentsCliDeps['stderr'],
): Promise<RunningApp | undefined> {
  if (settings === undefined) {
    return NO_APP;
  }
  const ensure =
    deps.ensureApp ??
    ((project: ProjectSettings) =>
      ensureApp(project, {
        projectsDir: projectsDir(deps),
        logDir: join(deps.repoRoot, APP_LOGS_DIR),
        env: process.env,
        stderr: progress,
        spawn: spawnToEnd,
      }));
  try {
    // Shared by the runs of this process (a sequence of agents in the panel): the last one to end stops it.
    return await shareApp(settings, ensure);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    deps.stderr.write(`✗ ${error.message}\n  O agente não foi executado.\n`);
    return undefined;
  }
}

/** Definitions changed during the provider: say which files, exit 1, and leave them as they are. */
function definitionChangeExit(changes: readonly string[], deps: RunAgentsCliDeps): number {
  deps.stderr.write(definitionChangeReport(changes));
  return 1;
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
  const prepared = await prepareRun(context, command, agent);
  if ('exitCode' in prepared) {
    return prepared.exitCode;
  }
  if (parsed.dryRun) {
    return runDryRun(prepared, ticketTarget, parsed, deps, settings, sandbox);
  }
  let createdContent: string | undefined;
  try {
    createdContent = createPlannedTicket(ticketTarget, deps.ticketTemplatesDir);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  const directories = definitionDirectories(context);
  const before = definitionSnapshot(directories);
  const exitCode = await runAndRecord(
    prepared.command,
    context.mode,
    prepared.effectiveTask,
    prepared.resolved,
    prepared.providerRequest,
    deps,
    sandbox,
    settings?.project,
    context.log,
  );
  const changes = definitionChanges(before, definitionSnapshot(directories));
  const guarded = changes.length === 0 ? exitCode : definitionChangeExit(changes, deps);
  const finished = finishTicket(
    ticketTarget,
    createdContent,
    context.mode,
    guarded,
    deps.stderr,
    deps.ticketTemplatesDir,
  );
  if (ticketTarget !== undefined && existsSync(ticketTarget.file)) deps.ticket?.(ticketTarget.ticket);
  return finished;
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
    deps.help?.agents();
    return 0;
  }
  return runCommand(parsed, deps);
}

/** `choliba list agents [--agents-dir DIR]`: the agents with their details, or its `--help`. */
export function runAgentsList(argv: readonly string[], deps: RunAgentsCliDeps): number {
  let parsed: ParsedListArgs;
  try {
    parsed = parseListArgs(argv);
  } catch (error) {
    deps.stderr.write(`${(error as AgentsArgsError).message}\n`);
    return 1;
  }
  if (parsed.kind === 'help') {
    deps.listHelp?.list();
    return 0;
  }
  return runList(parsed, deps);
}
