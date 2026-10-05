import { constants } from 'node:os';

import type { SessionExitEvent } from './types';

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
