import { agentsConfig, forgetSequence, listenModeKey, SANDBOX, showRun, showSandbox, TICKET } from '../agents';
import type { Container } from '@choliba/kernel';
import type { PanelContext } from '@choliba/shell';
import { moveAgent } from './agents-panel-order';

/** The sessions whose status line and agent card follow their choices already. */
const watching = new WeakSet<PanelContext>();

/**
 * Shows the mode and the sandbox in the status line from the session's start, Shift+Tab moving the mode, and keeps them
 * and the agents' cards up to date: the sandbox when it is chosen with /sandbox, the cards when a ticket is chosen with
 * /tickets, all of them when the session is cleared, which also forgets what its agents concluded. An agent's card
 * dragged onto another's takes its place in the sequence.
 */
export function watchChoices(container: Container, context: PanelContext): void {
  if (!container.has(agentsConfig.token)) return;
  showRun(container, context);
  listenModeKey(container, context);
  if (watching.has(context)) return;
  watching.add(context);
  context.onChange((key) => {
    if (key === SANDBOX) showSandbox(container, context);
    if (key === undefined) forgetSequence(context);
    if (key === undefined || key === TICKET) showRun(container, context);
  });
  context.onCardMove((id, onto, panel) => {
    moveAgent(container, context, id, onto, panel);
  });
}
