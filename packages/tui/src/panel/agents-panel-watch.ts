import {
  AGENT,
  RESUME_AT,
  agentPaint,
  listenModeKey,
  SANDBOX,
  sessionAgent,
  sessionAgentIds,
  showRun,
  showSandbox,
  TICKET,
  warn,
  sequenceRunning,
} from '@choliba/agents';
import type { Container } from '@choliba/kernel';
import type { ChatPanel, PanelContext } from '@choliba/shell';

/** The sessions whose status line and agent card follow their choices already. */
const watching = new WeakSet<PanelContext>();

/**
 * Moves the agent `id` to the place of `onto` in the session's sequence, as its card was dragged onto the other's; a
 * stopped sequence no longer resumes, its order changed. Not while the agents run.
 */
function moveAgent(container: Container, context: PanelContext, id: string, onto: string, panel: ChatPanel): void {
  if (sequenceRunning(context)) {
    panel.answer(warn('A ordem dos agentes não muda enquanto eles rodam.'));
    return;
  }
  const ids = [...sessionAgentIds(context)];
  const to = ids.indexOf(onto);
  if (!ids.includes(id) || to < 0) return;
  ids.splice(ids.indexOf(id), 1);
  ids.splice(to, 0, id);
  context.set(AGENT, ids.join(','));
  context.set(RESUME_AT, undefined);
  const named = (each: string): string => {
    const agent = sessionAgent(container, each);
    return agent === undefined ? each : agentPaint(container, agent)(each);
  };
  panel.answer(`Agente ${named(id)} movido. Ordem: ${ids.map(named).join(' → ')}.`);
  showRun(container, context);
}

/**
 * Shows the mode and the sandbox in the status line from the session's start, Shift+Tab moving the mode, and keeps them
 * and the agents' cards up to date: the sandbox when it is chosen with /sandbox, the cards when a ticket is chosen with
 * /tickets, all of them when the session is cleared. An agent's card dragged onto another's takes its place in the
 * sequence.
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
  context.onCardMove((id, onto, panel) => {
    moveAgent(container, context, id, onto, panel);
  });
}
