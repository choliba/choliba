import { boldAnsi, CARD_RULE, paintAnsi, THEME, type Container, type PanelCard } from '@choliba/core';

import type { AgentDefinition } from '../common';

/** What a run of the agent needs: a project and a ticket, a project, or nothing. */
function needs(agent: AgentDefinition): string {
  if (!agent.projectRequired) return 'sem projeto';
  return agent.ticketTypes === undefined || agent.allowWithoutTicket ? 'projeto' : 'projeto e ticket';
}

/** `text` in bold, in the agent's color, as a run paints its label: `CHOL_COLORS` first, then its `agent.color`. */
export function agentPaint(container: Container, agent: AgentDefinition): (text: string) => string {
  const color = container.get(THEME).colorOf('agents', agent.id, agent.color);
  return (text) => boldAnsi(paintAnsi(color, text));
}

/**
 * The agent's card: its name in its color and version, what it does, and what it needs and the models it takes;
 * collapsed, its id and version, then `run` (the mode and the model a run takes). Its spinner turns in its color.
 */
export function agentCard(container: Container, agent: AgentDefinition, run: string): Omit<PanelCard, 'title'> {
  const painted = agentPaint(container, agent);
  const version = `\u001b[90m${agent.version}\u001b[39m`;
  // The agent.yaml standard asks for at least one model.
  const models = ` · ${agent.supportedModels.join(', ')}`;
  return {
    lines: [
      `${painted(agent.displayName)} ${version}`,
      CARD_RULE,
      agent.description,
      CARD_RULE,
      `\u001b[90m${needs(agent)}${models}\u001b[39m`,
    ],
    summary: [`${painted(agent.id)} ${version}`, run],
    key: 'a',
    order: 3,
    color: container.get(THEME).colorOf('agents', agent.id, agent.color),
  };
}
