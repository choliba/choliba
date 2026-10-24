import { mkdirSync, rmSync } from 'node:fs';
import { constants } from 'node:os';

import type { SignalSource, Writable, WritableWithColumns } from '@choliba/kernel';

import type {
  AgentEvent,
  PlannedFile,
  ProviderRequest,
  ResolvedProvider,
  RunProcess,
  RunProcessExit,
  RunProcessRunner,
  RunScreen,
} from '../ports';
import { writePlan } from './plan-store';
import type { SandboxPath, SandboxPlace } from '@choliba/sandbox';
import { runToolsOf, toolGuard, toolViolation } from '../guards';
import { applyRunFiles, askExchangeDir } from './run-files';
import { watchQuestions } from './ask-watcher';
import { sessionInput } from './session-input';
import { writtenToolCall, writtenToolCallMessage } from './written-tool-call';
import { declaredModels } from './run-choice';
import {
  defaultResolvePlanContent,
  isSubstantiveAgentEvent,
  modelReportMissingMessage,
  validateReportedModel,
} from './run-event';

export interface RunFooterInfo {
  readonly provider: string;
  readonly place: SandboxPlace;
  readonly startedAt: number;
  readonly model?: string;
}

export interface RunLaunch {
  readonly command: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly place: SandboxPlace;
  readonly paths: readonly SandboxPath[];
  readonly skipped: readonly string[];
}

export type RunLogSource = 'saida' | 'erro' | 'provider' | 'provider-erro' | 'choliba';

export interface RunLog {
  readonly path: string;
  write(source: RunLogSource, text: string): void;
}

const NO_RUN_LOG: RunLog = { path: '', write: () => undefined };

function loggedStream<Stream extends Writable | WritableWithColumns>(
  stream: Stream,
  log: RunLog,
  source: RunLogSource,
): Stream {
  const logged = Object.create(stream) as Stream;
  logged.write = (chunk: string) => {
    log.write(source, chunk);
    stream.write(chunk);
  };
  return logged;
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 1 ? `${String(Math.round(seconds * 1000))}ms` : `${seconds.toFixed(1)}s`;
}

function exitCodeFor(event: RunProcessExit): number {
  if (event.exitCode !== null) return event.exitCode;
  const signal = event.signalCode === null ? undefined : constants.signals[event.signalCode];
  return signal === undefined ? 1 : 128 + signal;
}

export interface RunAgentDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the
   * `Bun` global. Every caller passes its own, same as the shell's `terminal run`.
   */
  readonly runner: RunProcessRunner;
  readonly stdout: WritableWithColumns;
  readonly stderr: Writable;
  readonly signals: SignalSource;
  readonly now: () => Date;
  /** Creates the presentation for this run; the agents package owns no terminal or panel drawing. */
  readonly screen: (info: RunFooterInfo, hostedPanel: boolean) => RunScreen | Promise<RunScreen>;
  /** Turns a normalized event into presentation text; the engine owns the event, not its terminal rendering. */
  readonly render: (event: AgentEvent, framed: boolean) => string | undefined;
  /** Calls `tick` every `ms` until the returned function stops it; `everySecond`'s timer when absent. */
  readonly every?: (ms: number, tick: () => void) => () => void;
  /** `true` when the host's panel keeps the conversation, so the run leaves its lines there on close. */
  readonly hostedPanel?: boolean;
  /** Called with the agent's final answer when the session ends clean: the `write_files` steps after it save it. */
  readonly answered?: (answer: string) => void;
  /**
   * Called with what the agent said last when its session ends, whatever its exit code: what the other agents of a
   * sequence are told it concluded (why it stopped, too).
   */
  readonly concluded?: (conclusion: string) => void;
  /** The run's log: what the screen shows, each line of the provider as it came, and the agent's time. */
  readonly log?: RunLog;
}

/** A timer that calls `tick` every `ms`, not keeping the process alive by itself. */
export function everySecond(ms: number, tick: () => void): () => void {
  const timer = setInterval(tick, ms);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}

export interface RunAgentRequest {
  readonly provider: ResolvedProvider;
  readonly providerRequest: ProviderRequest;
  readonly commandName: string;
  readonly task: string;
  readonly plansDir: string;
  /** The run tools' scripts (`planRunTools`), written next to the run folder for the session only. */
  readonly toolFiles?: readonly PlannedFile[];
  /**
   * How the provider's command starts once the run folder and the tools exist (`launchFor`): as it is, or in a
   * container. Absent, as it is.
   */
  readonly launch?: (command: readonly string[]) => RunLaunch;
}

/** The paths the agent may reach that the container leaves to the image, said before the session starts. */
export function imageFoldersNotice(skipped: readonly string[], kind: 'local' | 'docker'): string {
  const where =
    kind === 'local'
      ? 'No sandbox local, estes caminhos são do sistema e não são montados à parte'
      : 'No container, estes caminhos são da imagem e não vêm desta máquina';
  return `${where}: ${skipped.join(', ')}.`;
}

function errorMessage(error: unknown): string {
  return String(error);
}

/**
 * Runs one agent through one provider, via `ProcessRunnerService`: it owns
 * the child process, buffering and SIGINT/SIGTERM forwarding, exactly as the `terminal`
 * package's own CLI wrapper does. What this function adds on top is provider-specific: turning
 * each raw stdout line into `AgentEvent`s with the resolved provider's parser, rendering those
 * instead of the raw JSON, and — in `plan` mode — saving the result to a plan file.
 *
 * Deliberately reads `event.raw`, never `event.formatted`: `ProcessRunnerService` prefixes the *raw*
 * child output with `[label]`, which for a provider in `--output-format stream-json` is one
 * JSON object per line. Prefixing that would print JSON at the user, not a conversation.
 */
export async function runAgent(request: RunAgentRequest, deps: RunAgentDeps): Promise<number> {
  // The empty folder the provider runs in, the run tools next to it and whatever the adapter sets up for
  // the run (cursor's .cursor/cli.json), are removed however the session ends: success, failure, or
  // SIGINT/SIGTERM, which only kill the child and still let `runSession` return. The tools go first:
  // cursor's permissions are built from what is on disk.
  const runDir = request.providerRequest.runDir;
  let restoreTools: () => void = noop;
  let restore: () => void;
  try {
    mkdirSync(runDir, { recursive: true });
    restoreTools = applyRunFiles(request.toolFiles ?? []);
    restore = request.provider.adapter.prepareWorkspace?.(request.providerRequest) ?? noop;
  } catch (error) {
    restoreTools();
    rmSync(runDir, { recursive: true, force: true });
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }
  try {
    return await runSession(request, deps);
  } finally {
    restore();
    restoreTools();
    rmSync(runDir, { recursive: true, force: true });
  }
}

function noop(): void {
  // Nothing to restore.
}

async function runSession(request: RunAgentRequest, deps: RunAgentDeps): Promise<number> {
  const adapter = request.provider.adapter;
  const providerId = adapter.id;
  const label = request.providerRequest.agent.name;
  // Before the screen exists, what goes wrong is written here, and logged too.
  const stderr = loggedStream(deps.stderr, deps.log ?? NO_RUN_LOG, 'erro');

  let args: readonly string[];
  try {
    args = adapter.buildArgs(request.providerRequest);
  } catch (error) {
    stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  let session: RunProcess;
  let launch: RunLaunch;
  try {
    const command = [...request.provider.command, ...args];
    launch = request.launch?.(command) ?? { command, place: { kind: 'local' }, paths: [], skipped: [] };
    if (launch.skipped.length > 0) {
      stderr.write(`${imageFoldersNotice(launch.skipped, launch.place.kind)}\n`);
    }
    session = deps.runner.start({
      label,
      command: launch.command,
      cwd: request.providerRequest.runDir,
      ...(launch.env === undefined ? {} : { env: launch.env }),
      ...(adapter.inputMessage === undefined ? {} : { input: true }),
    });
  } catch (error) {
    stderr.write(`não foi possível iniciar ${providerId}: ${errorMessage(error)}\n`);
    return 1;
  }

  // The model asked of the provider, until it reports the one it runs: a provider that never says (codex) keeps it.
  const asked = request.providerRequest.model;
  const info: RunFooterInfo = {
    provider: providerId,
    place: launch.place,
    startedAt: deps.now().getTime(),
    ...(asked === undefined ? {} : { model: asked }),
  };
  const screenResult = deps.screen(info, deps.hostedPanel === true);
  const shown = 'then' in screenResult ? await screenResult : screenResult;
  const log = deps.log ?? NO_RUN_LOG;
  const screen = { ...shown, out: loggedStream(shown.out, log, 'saida'), err: loggedStream(shown.err, log, 'erro') };
  let exitCode = 1;
  try {
    exitCode = await followSession(request, deps, session, screen);
    return exitCode;
  } finally {
    const took = formatDuration(deps.now().getTime() - info.startedAt);
    log.write('choliba', `agente terminou: código ${String(exitCode)} · tempo do agente ${took}`);
    shown.close(exitCode);
  }
}

/**
 * The session from its first line to its exit: each line parsed and shown (guards stopping it when they must), the
 * signals passed on, then the exit code and, in `plan` mode, the saved plan.
 */
async function followSession(
  request: RunAgentRequest,
  deps: RunAgentDeps,
  session: RunProcess,
  screen: RunScreen,
): Promise<number> {
  const adapter = request.provider.adapter;
  const providerId = adapter.id;
  const label = request.providerRequest.agent.name;
  const parser = adapter.createParser();
  let doneEvent: Extract<AgentEvent, { type: 'done' }> | undefined;
  let planMarkdown: string | undefined;
  let reportedModel: string | undefined;
  const textParts: string[] = [];
  // The model the stream reports is checked against the models the agent declares for this run's provider.
  const supportedModels = declaredModels(request.providerRequest.agent, adapter.id);
  const explicitModel = request.providerRequest.model;
  const modelCtx = { providerId, agentName: label };
  // Set once a guard stopped the session (a model outside agent.yaml, a call to a subagent): what comes after
  // is not shown, and the run fails.
  const stopGuard = { triggered: false };
  // The sandbox decides each tool call on the policy written from the agent (its MCPs) and the provider's limits.
  const guard = toolGuard(request.providerRequest, adapter);

  const input = sessionInput(
    session,
    adapter.inputMessage?.bind(adapter),
    request.providerRequest.userPrompt,
    adapter.oneShotInput,
  );
  const stop = (message: string): void => {
    stopGuard.triggered = true;
    screen.err.write(`${message}\n`);
    input.close();
    session.kill('SIGTERM');
  };

  const log = deps.log ?? NO_RUN_LOG;
  session.subscribe((event) => {
    log.write(event.stream === 'stderr' ? 'provider-erro' : 'provider', event.raw);
    if (event.stream === 'stderr') {
      if (adapter.quietStderr?.(event.raw) === true) return;
      const readable = adapter.readableStderr?.(event.raw) ?? event.raw;
      // In the frame, a blank line from the provider (around its own messages) would only be an empty row.
      if (!screen.framed || readable.trim() !== '') screen.err.write(`${readable}\n`);
      return;
    }
    for (const agentEvent of parser.parseLine(event.raw)) {
      if (stopGuard.triggered) {
        return;
      }
      if (agentEvent.type === 'done') input.turnEnded();

      const violation = toolViolation(agentEvent, guard);
      if (violation !== undefined) {
        stop(violation);
        continue;
      }

      if (agentEvent.type === 'init' && agentEvent.model !== undefined) {
        const error = validateReportedModel(adapter.declaredModel(agentEvent.model), supportedModels, modelCtx);
        if (error !== undefined) {
          stop(error);
          continue;
        }
      }

      if (
        explicitModel === undefined &&
        supportedModels.length > 0 &&
        !parser.sawInitWithModel &&
        isSubstantiveAgentEvent(agentEvent)
      ) {
        stop(modelReportMissingMessage(supportedModels, modelCtx));
        continue;
      }

      if (agentEvent.type === 'done') {
        doneEvent = agentEvent;
      }
      if (agentEvent.type === 'plan') {
        planMarkdown = agentEvent.markdown;
      }
      if (agentEvent.type === 'text' && agentEvent.text !== '') {
        textParts.push(agentEvent.text);
      }

      if (agentEvent.type === 'init' && agentEvent.model !== undefined) {
        reportedModel = agentEvent.model;
        screen.model(agentEvent.model);
      }
      // In the frame, the model goes in the footer's table: the `· ready (model)` line would only repeat it.
      const rendered = screen.framed && agentEvent.type === 'init' ? undefined : deps.render(agentEvent, screen.framed);
      if (rendered !== undefined) {
        screen.out.write(`${rendered}\n`);
      }
    }
  });

  const onSignal = (signal: NodeJS.Signals): void => {
    session.kill(signal);
  };
  const onSigint = (): void => {
    onSignal('SIGINT');
  };
  const onSigterm = (): void => {
    onSignal('SIGTERM');
  };
  deps.signals.on('SIGINT', onSigint);
  deps.signals.on('SIGTERM', onSigterm);
  screen.onInterrupt(onSigint);
  input.begin();
  // What the person sends goes to the session and stays in the frame, saying why when it could not reach the agent. A
  // host's panel already shows what was said: there, a warning says it did not reach the agent, and what to do.
  screen.onMessage((text) => {
    const refused = input.send(text);
    if (deps.hostedPanel !== true) {
      screen.out.write(`› ${text}${refused === undefined ? '' : ` (não entregue: ${refused})`}\n`);
    } else if (refused !== undefined) {
      screen.warn.write(`Mensagem não entregue a ${request.providerRequest.agent.id}: ${refused}.\n`);
    }
  });
  const stopAsking = runToolsOf(request.providerRequest).some((tool) => tool.name === 'ask')
    ? watchQuestions(
        askExchangeDir(request.providerRequest.runDir),
        (question) => screen.answer(question),
        deps.every ?? everySecond,
      )
    : noop;

  const exitEvent = await new Promise<RunProcessExit>((resolve) => {
    session.onExit(resolve);
  });

  deps.signals.off('SIGINT', onSigint);
  deps.signals.off('SIGTERM', onSigterm);
  stopAsking();

  if (stopGuard.triggered) {
    return 1;
  }

  if (exitEvent.error !== null) {
    screen.err.write(`a sessão de ${providerId} falhou: ${exitEvent.error}\n`);
  }

  // The process's own exit code is the base signal — a crash or a killing signal always wins.
  // On top of that, a clean exit (0) is only a real success if a `done` event with no error was
  // actually seen: a truncated stream (the process exited 0 but never got to `result`) or a
  // `done.isError` both count as failure even though the exit code alone says otherwise.
  let exitCode = exitCodeFor(exitEvent);
  if (exitCode === 0 && (doneEvent === undefined || doneEvent.isError)) {
    exitCode = 1;
  }

  // A weak model may write its tool call as the answer instead of making it: the session ends clean with nothing run.
  const answer = doneEvent?.text === '' ? textParts.at(-1) : doneEvent?.text;
  const conclusion = answer ?? textParts.at(-1);
  if (conclusion !== undefined && conclusion.trim() !== '') deps.concluded?.(conclusion);
  const written = exitCode === 0 ? writtenToolCall(answer ?? '') : undefined;
  if (written !== undefined) {
    screen.err.write(`${writtenToolCallMessage(reportedModel, written)}\n`);
    return 1;
  }
  if (exitCode === 0 && answer !== undefined) deps.answered?.(answer);

  if (exitCode === 0 && request.providerRequest.mode === 'plan') {
    const content =
      adapter.resolvePlanContent === undefined
        ? defaultResolvePlanContent({ planMarkdown, doneEvent, textParts })
        : adapter.resolvePlanContent({ planMarkdown, doneEvent, textParts });
    if (content === undefined) {
      screen.err.write('nada para salvar: o provider não produziu texto de plano.\n');
      return 1;
    }
    const path = writePlan({
      plansDir: request.plansDir,
      agent: label,
      command: request.commandName,
      provider: providerId,
      task: request.task,
      content,
      now: deps.now(),
    });
    screen.out.write(`Plan saved: ${path}\n`);
  }

  return exitCode;
}
