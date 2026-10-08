import { mkdirSync, rmSync } from 'node:fs';

import type { ProcessRunnerService, Session, SessionExitEvent, SignalSource, Writable } from '@choliba/terminal';
import { exitCodeFor } from '@choliba/terminal';

import type { AgentEvent } from './interfaces/event.interface';
import { writePlan } from '../plans/plan-store';
import type { PlannedFile, ProviderRequest } from '../providers/interfaces/provider.interface';
import type { ResolvedProvider } from '../providers/provider-registry';
import {
  defaultResolvePlanContent,
  isSubstantiveAgentEvent,
  modelReportMissingMessage,
  validateReportedModel,
} from '../providers/stream-json';
import type { Theme } from '@choliba/core';

import { agentRenderOptions, formatProviderLine, renderEvent } from './render';
import { applyRunTools } from './run-tools/run-tools';
import { delegationMessage, delegationOf } from './delegation-guard';
import { mcpViolation } from './mcp-guard';

export interface RunAgentDeps {
  /**
   * No default: building one needs a `ProcessSpawner`, and the only real one touches the
   * `Bun` global. Every caller passes its own, same as `@choliba/terminal`'s own `runCli`.
   */
  readonly runner: ProcessRunnerService;
  readonly stdout: Writable;
  readonly stderr: Writable;
  readonly signals: SignalSource;
  readonly now: () => Date;
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
}

function errorMessage(error: unknown): string {
  return String(error);
}

/**
 * Runs one agent through one provider, via `@choliba/terminal`'s `ProcessRunnerService`: it owns
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
  try {
    session = deps.runner.start({
      label,
      command: [...request.provider.command, ...args],
      cwd: request.providerRequest.runDir,
    });
  } catch (error) {
    deps.stderr.write(`Failed to start ${providerId}: ${errorMessage(error)}\n`);
    return 1;
  }

  deps.stdout.write(`${formatProviderLine(providerId, request.theme)}\n`);

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
    deps.stderr.write(`${message}\n`);
    session.kill('SIGTERM');
  };

  session.subscribe((event) => {
    if (event.stream === 'stderr') {
      deps.stderr.write(`${event.raw}\n`);
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
        deps.stdout.write(`${rendered}\n`);
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
    deps.stderr.write(`${providerId} session failed: ${exitEvent.error}\n`);
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
      deps.stderr.write('Nothing to save: the provider produced no plan text.\n');
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
    deps.stdout.write(`Plan saved: ${path}\n`);
  }

  return exitCode;
}
