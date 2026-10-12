import { mkdirSync, rmSync } from 'node:fs';

import {
  exitCodeFor,
  StatusFooter,
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
import { footerLines, providerContext, summaryLine } from './run-footer';
import type { Launch } from './sandbox-launch';
import { applyRunTools } from '../../common';
import { delegationMessage, delegationOf } from './delegation-guard';
import { mcpViolation } from './mcp-guard';
import { unenforcedToolMessage, unenforcedToolOf } from './unenforced-tool-guard';

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
}

/** A timer that calls `tick` every `ms`, not keeping the process alive by itself. */
export function everySecond(ms: number, tick: () => void): () => void {
  const timer = setInterval(tick, ms);
  timer.unref();
  return () => {
    clearInterval(timer);
  };
}

/** The screen of a session: the streams as they are, or, with `deps.footer`, a footer that stays at the bottom. */
function runScreen(info: RunFooterInfo, theme: Theme, deps: RunAgentDeps): RunScreen {
  if (deps.footer !== true) return { out: deps.stdout, err: deps.stderr, close: noop };
  const now = (): number => deps.now().getTime();
  const footer = new StatusFooter(deps.stdout, (width) => footerLines(info, now(), width, theme));
  const stop = (deps.every ?? everySecond)(1000, () => {
    footer.draw();
  });
  footer.draw();
  return {
    out: footer.writer(deps.stdout),
    err: footer.writer(deps.stderr),
    close: (exitCode) => {
      stop();
      footer.close();
      deps.stdout.write(`${summaryLine(info, now(), exitCode)}\n`);
    },
  };
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
export function imageFoldersNotice(skipped: readonly string[]): string {
  return `No container, estes caminhos são da imagem e não vêm desta máquina: ${skipped.join(', ')}.`;
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
      deps.stderr.write(`${imageFoldersNotice(launch.skipped)}\n`);
    }
    session = deps.runner.start({
      label,
      command: launch.command,
      cwd: request.providerRequest.runDir,
      ...(launch.env === undefined ? {} : { env: launch.env }),
    });
  } catch (error) {
    deps.stderr.write(`Failed to start ${providerId}: ${errorMessage(error)}\n`);
    return 1;
  }

  const info: RunFooterInfo = { provider: providerId, place: launch.place, startedAt: deps.now().getTime() };
  deps.stdout.write(`${formatProviderLine(providerId, request.theme)}${providerContext(info)}\n`);
  const screen = runScreen(info, request.theme, deps);
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
  const renderOptions = agentRenderOptions(label, request.providerRequest.agent.color, request.theme);
  let doneEvent: Extract<AgentEvent, { type: 'done' }> | undefined;
  let planMarkdown: string | undefined;
  const textParts: string[] = [];
  const supportedModels = request.providerRequest.agent.supportedModels;
  const explicitModel = request.providerRequest.model;
  const modelCtx = { providerId, agentName: label };
  // Set once a guard stopped the session (a model outside agent.yaml, a call to a subagent): what comes after
  // is not shown, and the run fails.
  const stopGuard = { triggered: false };

  const stop = (message: string): void => {
    stopGuard.triggered = true;
    screen.err.write(`${message}\n`);
    session.kill('SIGTERM');
  };

  session.subscribe((event) => {
    if (event.stream === 'stderr') {
      screen.err.write(`${event.raw}\n`);
      return;
    }
    for (const agentEvent of parser.parseLine(event.raw)) {
      if (stopGuard.triggered) {
        return;
      }

      const subagent = delegationOf(agentEvent);
      if (subagent !== undefined) {
        stop(delegationMessage(subagent));
        continue;
      }

      const unenforced = unenforcedToolOf(agentEvent, request.provider.adapter.unenforcedTools);
      if (unenforced !== undefined) {
        stop(unenforcedToolMessage(unenforced));
        continue;
      }

      const undeclaredMcp = mcpViolation(agentEvent, label, request.providerRequest.agent.mcps);
      if (undeclaredMcp !== undefined) {
        stop(undeclaredMcp);
        continue;
      }

      if (agentEvent.type === 'init' && agentEvent.model !== undefined) {
        const error = validateReportedModel(agentEvent.model, supportedModels, modelCtx);
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

      const rendered = renderEvent(agentEvent, renderOptions);
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

  const exitEvent = await new Promise<SessionExitEvent>((resolve) => {
    session.onExit(resolve);
  });

  deps.signals.off('SIGINT', onSigint);
  deps.signals.off('SIGTERM', onSigterm);

  if (stopGuard.triggered) {
    return 1;
  }

  if (exitEvent.error !== null) {
    screen.err.write(`${providerId} session failed: ${exitEvent.error}\n`);
  }

  // The process's own exit code is the base signal — a crash or a killing signal always wins.
  // On top of that, a clean exit (0) is only a real success if a `done` event with no error was
  // actually seen: a truncated stream (the process exited 0 but never got to `result`) or a
  // `done.isError` both count as failure even though the exit code alone says otherwise.
  let exitCode = exitCodeFor(exitEvent);
  if (exitCode === 0 && (doneEvent === undefined || doneEvent.isError)) {
    exitCode = 1;
  }

  if (exitCode === 0 && request.providerRequest.mode === 'plan') {
    const content =
      adapter.resolvePlanContent === undefined
        ? defaultResolvePlanContent({ planMarkdown, doneEvent, textParts })
        : adapter.resolvePlanContent({ planMarkdown, doneEvent, textParts });
    if (content === undefined) {
      screen.err.write('Nothing to save: the provider produced no plan text.\n');
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
