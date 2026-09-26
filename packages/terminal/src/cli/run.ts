import { constants } from 'node:os';

import type { ProcessRunner } from '../process-runner';
import type { Session } from '../session';
import type { SessionExitEvent } from '../types';
import type { Writable } from '../writable';
import { defaultStderr, defaultStdout } from '../writable';
import type { ParsedRunArgs } from './args';
import { parseRunArgs } from './args';

export type { Writable } from '../writable';

export interface SignalSource {
  on(event: NodeJS.Signals, listener: () => void): void;
  off(event: NodeJS.Signals, listener: () => void): void;
}

export interface RunCliDeps {
  /**
   * No default here: building one would need a `ProcessSpawner`, and the only real one
   * touches the `Bun` global (see `spawn.ts`). Every caller — `cli/main.ts` in production,
   * every spec in tests — passes its own explicitly.
   */
  readonly runner: ProcessRunner;
  readonly stdout?: Writable;
  readonly stderr?: Writable;
  /** Defaults to Node's `process`; specs inject a fake to test signal forwarding safely. */
  readonly signals?: SignalSource;
}

function errorMessage(error: unknown): string {
  return String(error);
}

/**
 * Shell convention: a process killed by signal N reports 128 + N, so a caller can tell
 * "the command failed" (1) from "someone pressed Ctrl+C" (130). `signalNumbers` is a
 * parameter so specs can use a fixed table instead of the host's, which varies by platform.
 */
export function exitCodeFor(
  event: SessionExitEvent,
  signalNumbers: Readonly<Record<string, number>> = constants.signals,
): number {
  if (event.exitCode !== null) {
    return event.exitCode;
  }
  if (event.signalCode !== null) {
    const signalNumber = signalNumbers[event.signalCode];
    if (signalNumber !== undefined) {
      return 128 + signalNumber;
    }
  }
  return 1;
}

/**
 * The CLI wrapper's testable logic: parses `argv`, starts a session, prints its
 * formatted output to `stdout`/`stderr` as it arrives (so local DX is unchanged),
 * forwards SIGINT/SIGTERM to the child so a wrapped dev server does not linger as
 * an orphan, and resolves with the session's exit code.
 */
export async function runCli(argv: readonly string[], deps: RunCliDeps): Promise<number> {
  const stdout = deps.stdout ?? defaultStdout;
  const stderr = deps.stderr ?? defaultStderr;
  const signals = deps.signals ?? process;

  let parsed: ParsedRunArgs;
  try {
    parsed = parseRunArgs(argv);
  } catch (error) {
    stderr.write(`${errorMessage(error)}\n`);
    return 1;
  }

  let session: Session;
  try {
    session = deps.runner.start({
      label: parsed.label,
      command: parsed.command,
      withTimestamp: parsed.withTimestamp,
      colorize: parsed.colorize,
    });
  } catch (error) {
    stderr.write(`Failed to start "${parsed.command.join(' ')}": ${errorMessage(error)}\n`);
    return 1;
  }

  session.subscribe((event) => {
    const target = event.stream === 'stderr' ? stderr : stdout;
    target.write(`${event.formatted}\n`);
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
  signals.on('SIGINT', onSigint);
  signals.on('SIGTERM', onSigterm);

  const exitEvent = await new Promise<SessionExitEvent>((resolve) => {
    session.onExit(resolve);
  });

  signals.off('SIGINT', onSigint);
  signals.off('SIGTERM', onSigterm);

  if (exitEvent.error !== null) {
    stderr.write(`Session for "${parsed.command.join(' ')}" failed: ${exitEvent.error}\n`);
  }

  return exitCodeFor(exitEvent);
}
