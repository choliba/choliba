/**
 * The agent's input while it works: what is typed during a turn (kept for
 * the next one, or delivered live), Ctrl+A for the approvals, and the
 * terminal conversation every agent uses by default.
 */

import { StdioAdapter } from '../adapters/stdio/index';
import { Conversation, type InteractionAdapter } from '../interaction/index';
import { anySignal } from './abort';

export interface NextTurn {
  readonly input: string;
  readonly approved: boolean;
}

export interface PendingInput {
  readonly promise: Promise<string>;
  submitted(): Promise<string> | undefined;
  cancel(): void;
}

/**
 * Reads the terminal for the whole turn, while the provider works. `map`
 * returns `undefined` for input handled locally (Ctrl+A with nothing
 * approved): then it reads again. `onKept` hears of each message kept
 * because nobody waits for it yet. Ctrl+A keeps working after a message was
 * typed; messages typed during the turn are kept and go together, in order,
 * as the next input. Approvals given before anyone awaits the input do not
 * end the reading either; whoever awaits it later gets them first.
 */
export function listenInput(
  listen: ((signal?: AbortSignal) => Promise<string>) | undefined,
  signal: AbortSignal | undefined,
  map: (input: string) => Promise<string | undefined> = (input) =>
    Promise.resolve(input),
  onKept?: (message: string) => void,
): PendingInput | undefined {
  if (listen === undefined) return undefined;

  const controller = new AbortController();
  const combined = anySignal(signal, controller.signal);
  /** Messages typed while nobody waited for them yet. */
  const messages: string[] = [];
  /** Approvals given while nobody waited for this input yet. */
  let approved = false;
  /** Who awaits the input (a question, the end of the turn), if anyone. */
  let waiter: ((value: string) => void) | undefined;
  let failed: ((error: unknown) => void) | undefined;
  /** The reading failed (e.g. the input ended) before anyone waited. */
  let failure: { readonly error: unknown } | undefined;
  let taken: Promise<string> | undefined;

  const deliver = (value: string): void => {
    controller.abort();
    waiter?.(value);
  };

  const read = async (): Promise<void> => {
    for (;;) {
      const input = await listen(combined);
      // A bare Enter says nothing (e.g. one left in the terminal by the
      // previous program): keep listening instead of ending the turn's input.
      if (input.trim().length === 0) continue;
      const mapped = await map(input);
      if (mapped === undefined) continue;
      if (waiter !== undefined) {
        deliver(mapped);
        return;
      }
      // Nobody waits yet: keep reading (Ctrl+A again, more messages); the
      // end of the turn goes on with what was typed or approved.
      if (mapped === APPROVALS_FINISHED) approved = true;
      else {
        messages.push(mapped);
        onKept?.(mapped);
      }
    }
  };
  void read().catch((error: unknown) => {
    failure = { error };
    failed?.(error);
  });

  const take = (): Promise<string> => {
    taken ??= ((): Promise<string> => {
      if (messages.length > 0) {
        controller.abort();
        return Promise.resolve(messages.join('\n\n'));
      }
      if (approved) {
        controller.abort();
        return Promise.resolve(APPROVALS_FINISHED);
      }
      // Kept for whoever waits later, or they would wait forever.
      if (failure !== undefined) return Promise.reject(failure.error);
      return new Promise<string>((resolve, reject) => {
        waiter = resolve;
        failed = reject;
      });
    })();
    return taken;
  };

  return {
    get promise() {
      return take();
    },
    submitted: () => (messages.length > 0 || approved ? take() : undefined),
    cancel: () => controller.abort(),
  };
}

export const APPROVAL_COMMANDS: ReadonlySet<string> = new Set([
  ':approvals',
  'bun run approvals',
]);

/** The agent's shortcuts on a terminal: Ctrl+A opens the approvals. */
export const AGENT_SHORTCUTS: Readonly<Record<string, string>> = {
  '\u0001': 'approvals',
};

/**
 * The conversation an agent uses, over `adapter` (stdio with
 * `AGENT_SHORTCUTS` by default): the approvals command (`:approvals`, which
 * Ctrl+A sends) typed during a turn goes ahead of the messages waiting.
 */
export function agentConversation(
  adapter: InteractionAdapter = new StdioAdapter({
    shortcuts: AGENT_SHORTCUTS,
  }),
): Conversation {
  return new Conversation(adapter, { urgent: isApprovalsCommand });
}

export const APPROVALS_FINISHED = '\u0000choliba:approvals-finished';

export function isApprovalsCommand(input: string): boolean {
  return APPROVAL_COMMANDS.has(input.trim().toLowerCase());
}

export function isLocalApprovalResult(input: string): boolean {
  return input === APPROVALS_FINISHED || isApprovalsCommand(input);
}
