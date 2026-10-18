import type { Session } from '@choliba/core';

/** What a run sends to its session while it runs: the task, then the person's messages. */
export interface SessionInput {
  /** Sends the task, the first message. */
  begin(): void;
  /** Sends what the person typed; why it did not reach the agent, or `undefined` when it did. */
  send(text: string): string | undefined;
  /** A turn of the agent ended (`done`): with no message left in flight, stdin closes and the session finishes. */
  turnEnded(): void;
  /** Closes stdin, whatever is in flight (a guard stopped the session). */
  close(): void;
}

/** Why a message did not reach a provider that reads none while it runs. */
export const NOT_READ = 'este provider não recebe mensagens durante a execução';

/** Why a message did not reach a session whose stdin is already closed. */
export const ALREADY_DONE = 'o agente já terminou';

/**
 * The input of `session`, for a provider whose `message` turns a text into the line its stdin takes, or `undefined` for
 * one that reads nothing while it runs. Each message sent is in flight until a turn ends; when none is left, stdin
 * closes, which ends a session that reads until the end of it. A `oneShot` provider reads the task alone: stdin closes
 * right after it, and a message is not read.
 */
export function sessionInput(
  session: Pick<Session, 'write' | 'endInput'>,
  message: ((text: string) => string) | undefined,
  task: string,
  oneShot = false,
): SessionInput {
  let inFlight = 0;
  const deliver = (text: string): boolean => {
    if (message === undefined || !session.write(message(text))) return false;
    inFlight += 1;
    return true;
  };
  return {
    begin: () => {
      deliver(task);
      if (message !== undefined && oneShot) session.endInput();
    },
    send: (text) => {
      if (message === undefined || oneShot) return NOT_READ;
      return deliver(text) ? undefined : ALREADY_DONE;
    },
    turnEnded: () => {
      if (message === undefined || oneShot) return;
      inFlight = Math.max(inFlight - 1, 0);
      if (inFlight === 0) session.endInput();
    },
    close: () => {
      session.endInput();
    },
  };
}
