import { mkdirSync, rmSync } from 'node:fs';

import {
  DEFAULT_COLUMNS,
  exitCodeFor,
  frameBottom,
  frameLines,
  frameTop,
  StatusFooter,
  type Panel,
  type PanelOptions,
  type ProcessRunnerService,
  type Session,
  type SessionExitEvent,
  type SignalSource,
  type Theme,
  type Writable,
  type WritableWithColumns,
} from '@choliba/core';

import type { AgentEvent } from '../../common';
import { writePlan } from './plan-store';
import type { PlannedFile, ProviderRequest } from '../../common';
import type { ResolvedProvider } from '../../common';
import {
  defaultResolvePlanContent,
  isSubstantiveAgentEvent,
  modelReportMissingMessage,
  validateReportedModel,
} from '../../common';

import { agentRenderOptions, formatProviderLine, renderEvent } from './event-render';
import type { RunFooterInfo, RunScreen } from '../interfaces/run-footer.interface';
import { footerLines, oneLine, providerContext, summaryLine } from './run-footer';
import type { Launch } from './sandbox-launch';
import { applyRunTools, askExchangeDir, runToolsOf, type AskAnswer } from '../../common';
import { watchQuestions } from './ask-watcher';
import { sessionInput } from './session-input';
import { toolGuard, toolViolation } from './tool-guard';
import { writtenToolCall, writtenToolCallMessage } from './written-tool-call';

export interface RunAgentDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the
   * `Bun` global. Every caller passes its own, same as the shell's `terminal run`.
   */
  readonly runner: ProcessRunnerService;
  readonly stdout: WritableWithColumns;
  readonly stderr: Writable;
  readonly signals: SignalSource;
  readonly now: () => Date;
  /** Draw the footer with the run's provider, sandbox and elapsed time (`wantsFooter`): only on a terminal. */
  readonly footer?: boolean;
  /** Calls `tick` every `ms` until the returned function stops it; `everySecond`'s timer when absent. */
  readonly every?: (ms: number, tick: () => void) => () => void;
  /**
   * Opens the panel a run on a terminal is drawn in (`openOpenTuiPanel`), or gives `undefined` when it cannot; the run
   * then draws the frame and footer. Absent, never a panel.
   */
  readonly panel?: (options: PanelOptions) => Promise<Panel | undefined>;
  /**
   * `true` when the panel is lent by a host that keeps the conversation (`choliba panel`): the run then leaves its
   * lines there instead of printing its frame on the terminal when it closes.
   */
  readonly hostedPanel?: boolean;
}

/** A timer that calls `tick` every `ms`, not keeping the process alive by itself. */
export function everySecond(ms: number, tick: () => void): () => void {
  const timer = setInterval(tick, ms);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}

/** The width a screen draws in: the terminal's, or `DEFAULT_COLUMNS` when it says none (absent, or 0 in a pseudo-terminal). */
export function screenWidth(stdout: WritableWithColumns): number {
  const columns = stdout.columns ?? 0;
  return columns > 0 ? columns : DEFAULT_COLUMNS;
}

/** How often the footer is drawn again: often enough for the milliseconds to roll, cheap for the terminal. */
export const FOOTER_REFRESH_MS = 50;

/** The streams of a session as they are, with the `[provider]` line first: where there is no footer. */
function plainScreen(info: RunFooterInfo, theme: Theme, deps: RunAgentDeps): RunScreen {
  deps.stdout.write(`${formatProviderLine(info.provider, theme)}${providerContext(info)}\n`);
  return {
    framed: false,
    out: deps.stdout,
    err: deps.stderr,
    model: noop,
    onInterrupt: noop,
    onMessage: noop,
    answer: unanswered,
    close: noop,
  };
}

/**
 * The screen of a session on a terminal: a blank line after the command, a frame titled with the agent that the
 * session's lines go in, and a footer under it with the run's context and time, drawn every `FOOTER_REFRESH_MS`.
 * Closing it leaves the bottom of the frame and the summary line.
 */
function footerScreen(info: RunFooterInfo, request: RunAgentRequest, deps: RunAgentDeps): RunScreen {
  const { theme } = request;
  const { name, color } = request.providerRequest.agent;
  const now = (): number => deps.now().getTime();
  const width = (): number => screenWidth(deps.stdout);
  let model: string | undefined;
  const current = (): RunFooterInfo => (model === undefined ? info : { ...info, model });
  deps.stdout.write(`\n${frameTop(name, width(), (text) => theme.paint('agents', name, text, color))}\n`);
  const footer = new StatusFooter(deps.stdout, (columns) => footerLines(current(), now(), columns, theme));
  const framed = (stream: Writable): Writable => {
    const above = footer.writer(stream);
    return {
      write: (text) => {
        above.write(`${frameLines(text, width()).join('\n')}\n`);
      },
    };
  };
  const stop = (deps.every ?? everySecond)(FOOTER_REFRESH_MS, () => {
    footer.draw();
  });
  footer.draw();
  return {
    framed: true,
    out: framed(deps.stdout),
    err: framed(deps.stderr),
    model: (reported) => {
      model = reported;
    },
    onInterrupt: noop,
    onMessage: noop,
    answer: unanswered,
    close: (exitCode) => {
      stop();
      footer.close();
      deps.stdout.write(`${frameBottom(width())}\n${summaryLine(current(), now(), exitCode)}\n`);
    },
  };
}

/** The run's footer information, with the model once the provider reports it. */
interface ReportedInfo {
  info(): RunFooterInfo;
  report(model: string): void;
}

function reportedInfo(info: RunFooterInfo): ReportedInfo {
  let model: string | undefined;
  return {
    info: () => (model === undefined ? info : { ...info, model }),
    report: (reported) => {
      model = reported;
    },
  };
}

/**
 * The screen of a session in the run panel: the session's lines scroll in it with the footer under it, and, once it
 * closes, the whole frame and the summary line are printed on the terminal, as the frame and footer leave them.
 */
function panelScreen(panel: Panel, current: ReportedInfo, request: RunAgentRequest, deps: RunAgentDeps): RunScreen {
  const { theme } = request;
  const { name, color } = request.providerRequest.agent;
  const now = (): number => deps.now().getTime();
  const width = (): number => screenWidth(deps.stdout);
  const transcript: string[] = [];
  const shown: Writable = {
    write: (text) => {
      transcript.push(text);
      panel.write(text);
    },
  };
  const stop = (deps.every ?? everySecond)(FOOTER_REFRESH_MS, () => {
    panel.refresh();
  });
  return {
    framed: true,
    out: shown,
    err: shown,
    model: (reported) => {
      current.report(reported);
    },
    onInterrupt: (listener) => {
      panel.onInterrupt(listener);
    },
    onMessage: (listener) => {
      panel.onMessage(listener);
    },
    answer: async (question) => {
      shown.write(`? ${question.question}\n`);
      const reply = await panel.ask(question);
      shown.write(`→ ${reply.status === 'skipped' ? '(sem resposta)' : [reply.answer].flat().join(', ')}\n`);
      return reply;
    },
    close: (exitCode) => {
      stop();
      panel.close();
      if (deps.hostedPanel === true) return;
      const top = frameTop(name, width(), (text) => theme.paint('agents', name, text, color));
      const lines = frameLines(transcript.join(''), width());
      deps.stdout.write(
        `\n${[top, ...lines, frameBottom(width())].join('\n')}\n${summaryLine(current.info(), now(), exitCode)}\n`,
      );
    },
  };
}

/** Where a session writes when no panel is to be opened: as it is off a terminal, the frame and footer on one. */
function runScreen(info: RunFooterInfo, request: RunAgentRequest, deps: RunAgentDeps): RunScreen {
  return deps.footer === true ? footerScreen(info, request, deps) : plainScreen(info, request.theme, deps);
}

/** On a terminal that may draw one, the run panel when it opens; the frame and footer otherwise. */
async function panelOrFooter(
  open: NonNullable<RunAgentDeps['panel']>,
  info: RunFooterInfo,
  request: RunAgentRequest,
  deps: RunAgentDeps,
): Promise<RunScreen> {
  const { name, color } = request.providerRequest.agent;
  const now = (): number => deps.now().getTime();
  const current = reportedInfo(info);
  const panel = await open({
    title: name,
    titleColor: request.theme.colorOf('agents', name, color),
    footer: (columns) => [oneLine(current.info(), now(), Math.floor(columns / 2))],
    hint:
      request.provider.adapter.inputMessage === undefined
        ? 'Aqui você responde quando o agente perguntar'
        : 'Enter envia · Ctrl+J cria uma linha',
  });
  return panel === undefined ? footerScreen(info, request, deps) : panelScreen(panel, current, request, deps);
}

export interface RunAgentRequest {
  readonly provider: ResolvedProvider;
  readonly providerRequest: ProviderRequest;
  readonly commandName: string;
  readonly task: string;
  readonly plansDir: string;
  /** The colors of what it prints, and whether to color at all (`ThemeService`). */
  readonly theme: Theme;
  /** The run tools' scripts (`planRunTools`), written next to the run folder for the session only. */
  readonly toolFiles?: readonly PlannedFile[];
  /**
   * How the provider's command starts once the run folder and the tools exist (`launchFor`): as it is, or in a
   * container. Absent, as it is.
   */
  readonly launch?: (command: readonly string[]) => Launch;
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
    restoreTools = applyRunTools(request.toolFiles ?? []);
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

/** What a screen with no field answers: nobody can, so the agent goes on with an assumption at once. */
function unanswered(): Promise<AskAnswer> {
  return Promise.resolve({ status: 'unavailable' });
}

function noop(): void {
  // Nothing to restore.
}

async function runSession(request: RunAgentRequest, deps: RunAgentDeps): Promise<number> {
  const adapter = request.provider.adapter;
  const providerId = adapter.id;
  const label = request.providerRequest.agent.name;

  let args: readonly string[];
  try {
    args = adapter.buildArgs(request.providerRequest);
  } catch (error) {
    deps.stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  let session: Session;
  let launch: Launch;
  try {
    const command = [...request.provider.command, ...args];
    launch = request.launch?.(command) ?? { command, place: { kind: 'local' }, paths: [], skipped: [] };
    if (launch.skipped.length > 0) {
      deps.stderr.write(`${imageFoldersNotice(launch.skipped, launch.place.kind)}\n`);
    }
    session = deps.runner.start({
      label,
      command: launch.command,
      cwd: request.providerRequest.runDir,
      ...(launch.env === undefined ? {} : { env: launch.env }),
      ...(adapter.inputMessage === undefined ? {} : { input: true }),
    });
  } catch (error) {
    deps.stderr.write(`não foi possível iniciar ${providerId}: ${errorMessage(error)}\n`);
    return 1;
  }

  const info: RunFooterInfo = { provider: providerId, place: launch.place, startedAt: deps.now().getTime() };
  const screen =
    deps.footer === true && deps.panel !== undefined
      ? await panelOrFooter(deps.panel, info, request, deps)
      : runScreen(info, request, deps);
  let exitCode = 1;
  try {
    exitCode = await followSession(request, deps, session, screen);
    return exitCode;
  } finally {
    screen.close(exitCode);
  }
}

/**
 * The session from its first line to its exit: each line parsed and shown (guards stopping it when they must), the
 * signals passed on, then the exit code and, in `plan` mode, the saved plan.
 */
async function followSession(
  request: RunAgentRequest,
  deps: RunAgentDeps,
  session: Session,
  screen: RunScreen,
): Promise<number> {
  const adapter = request.provider.adapter;
  const providerId = adapter.id;
  const label = request.providerRequest.agent.name;
  const parser = adapter.createParser();
  const renderOptions = {
    ...agentRenderOptions(label, request.providerRequest.agent.color, request.theme),
    labeled: !screen.framed,
  };
  let doneEvent: Extract<AgentEvent, { type: 'done' }> | undefined;
  let planMarkdown: string | undefined;
  let reportedModel: string | undefined;
  const textParts: string[] = [];
  const supportedModels = request.providerRequest.agent.supportedModels;
  const explicitModel = request.providerRequest.model;
  const modelCtx = { providerId, agentName: label };
  // Set once a guard stopped the session (a model outside agent.yaml, a call to a subagent): what comes after
  // is not shown, and the run fails.
  const stopGuard = { triggered: false };
  // The sandbox decides each tool call on the policy written from the agent (its MCPs) and the provider's limits.
  const guard = toolGuard(request.providerRequest, adapter.unenforcedTools);

  const input = sessionInput(session, adapter.inputMessage?.bind(adapter), request.providerRequest.userPrompt);
  const stop = (message: string): void => {
    stopGuard.triggered = true;
    screen.err.write(`${message}\n`);
    input.close();
    session.kill('SIGTERM');
  };

  session.subscribe((event) => {
    if (event.stream === 'stderr') {
      if (adapter.quietStderr?.(event.raw) === true) return;
      // In the frame, a blank line from the provider (around its own messages) would only be an empty row.
      if (!screen.framed || event.raw.trim() !== '') screen.err.write(`${event.raw}\n`);
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
      const rendered = screen.framed && agentEvent.type === 'init' ? undefined : renderEvent(agentEvent, renderOptions);
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
  // host's panel already shows what was said: there, the frame says only that it did not reach the agent.
  screen.onMessage((text) => {
    const refused = input.send(text);
    if (deps.hostedPanel !== true) {
      screen.out.write(`› ${text}${refused === undefined ? '' : ` (não entregue: ${refused})`}\n`);
    } else if (refused !== undefined) {
      screen.out.write(`(não entregue: ${refused})\n`);
    }
  });
  const stopAsking = runToolsOf(request.providerRequest).some((tool) => tool.name === 'ask')
    ? watchQuestions(
        askExchangeDir(request.providerRequest.runDir),
        (question) => screen.answer(question),
        deps.every ?? everySecond,
      )
    : noop;

  const exitEvent = await new Promise<SessionExitEvent>((resolve) => {
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
  const written = exitCode === 0 ? writtenToolCall(answer ?? '') : undefined;
  if (written !== undefined) {
    screen.err.write(`${writtenToolCallMessage(reportedModel, written)}\n`);
    return 1;
  }

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
