import { boldAnsi, CARD_RULE, paintAnsi, THEME, type Container, type PanelCard } from '@choliba/core';

import type { AgentDefinition } from '../common';

/** `text` in bold, in the agent's color, as a run paints its label: `CHOL_COLORS` first, then its `agent.color`. */
export function agentPaint(container: Container, agent: AgentDefinition): (text: string) => string {
  const color = container.get(THEME).colorOf('agents', agent.id, agent.color);
  return (text) => boldAnsi(paintAnsi(color, text));
}

/**
 * The agent's card: its name in its color and version, and what it does; collapsed, its id and version, `run` (the mode and the model a run takes), and the `ticket` a run takes, or
 * `sem ticket`. Its spinner turns in its color.
 */
export function agentCard(
  container: Container,
  agent: AgentDefinition,
  run: string,
  ticket?: string,
): Omit<PanelCard, 'title'> {
  const painted = agentPaint(container, agent);
  const version = `\u001b[90m${agent.version}\u001b[39m`;
  return {
    lines: [`${painted(agent.displayName)} ${version}`, CARD_RULE, agent.description],
    summary: [
      `${painted(agent.id)} ${version}`,
      run,
      ticket === undefined ? '\u001b[90msem ticket\u001b[39m' : `ticket \u001b[1m${ticket}\u001b[22m`,
    ],
    key: 'a',
    order: 3,
    color: container.get(THEME).colorOf('agents', agent.id, agent.color),
  };
}
