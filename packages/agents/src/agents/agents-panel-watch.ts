import type { Container, PanelContext } from '@choliba/core';

import { listenModeKey, SANDBOX, showRun, showSandbox, TICKET } from './agents-panel-state';

/** The sessions whose status line and agent card follow their choices already. */
const watching = new WeakSet<PanelContext>();

/**
 * Shows the mode and the sandbox in the status line from the session's start, Shift+Tab moving the mode, and keeps them
 * and the agent's card up to date: the sandbox when it is chosen with /sandbox, the card when a ticket is chosen with
 * /tickets, all of them when the session is cleared.
 */
export function watchChoices(container: Container, context: PanelContext): void {
  showRun(container, context);
  listenModeKey(container, context);
  if (watching.has(context)) return;
  watching.add(context);
  context.onChange((key) => {
    if (key === SANDBOX) showSandbox(container, context);
    if (key === undefined || key === TICKET) showRun(container, context);
  });
}
