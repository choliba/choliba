import {
  boldAnsi,
  CARD_RULE,
  paintAnsi,
  THEME,
  type AnsiColor,
  type Container,
  type PanelCard,
  type PanelVoice,
} from '@choliba/core';

import type { AgentDefinition } from '../common';

/** `text` in bold, in the agent's color, as a run paints its label: `CHOL_COLORS` first, then its `agent.color`. */
export function agentPaint(container: Container, agent: AgentDefinition): (text: string) => string {
  const color = agentColor(container, agent);
  return (text) => boldAnsi(paintAnsi(color, text));
}

/** The agent's color: `CHOL_COLORS` first, then its `agent.color`. */
function agentColor(container: Container, agent: AgentDefinition): AnsiColor {
  return container.get(THEME).colorOf('agents', agent.id, agent.color);
}

/** Who writes the agent's lines in the panel's conversation: its id, in its color. */
export function agentVoice(container: Container, agent: AgentDefinition): PanelVoice {
  return { name: agent.id, color: agentColor(container, agent) };
}

/** The provider and the model a run of the agent takes, as the card's footer and the header's column show them. */
export interface AgentRunLabels {
  readonly provider: string;
  readonly model: string;
}

/** Where an agent's card is among the session's: its place, and whether it says how its last run went. */
export interface AgentCardPlace {
  /** Its place in the session's sequence, from 0: the cards after the first are joined to the one before. */
  readonly at: number;
  /** How its last run went (`concluído · 2m10s`); `aguardando` when absent. */
  readonly state?: string | undefined;
}

/** The order of the first agent's card among the header's (`sandbox` 1, `projeto` 2); the others follow it. */
const AGENT_ORDER = 3;

/**
 * The agent's card, titled with its id: its name in its color and version, and what it does, with the provider and the
 * model a run takes in its footer; collapsed, its state, `provider · model` and the `ticket` a run takes, or `sem
 * ticket`. Its left border and its bar are in its color; after the first of the sequence, it is joined to the one
 * before.
 */
export function agentCard(
  container: Container,
  agent: AgentDefinition,
  labels: AgentRunLabels,
  place: AgentCardPlace,
  ticket?: string,
): Omit<PanelCard, 'title'> {
  const painted = agentPaint(container, agent);
  const version = `\u001b[90m${agent.version}\u001b[39m`;
  const color = agentColor(container, agent);
  return {
    lines: [`${painted(agent.displayName)} ${version}`, CARD_RULE, agent.description],
    footer: [`provider ${labels.provider}`, `modelo   ${labels.model}`],
    summary: [
      `${labels.provider} \u001b[90m·\u001b[39m ${labels.model}`,
      ticket === undefined ? '\u001b[90msem ticket\u001b[39m' : `ticket \u001b[1m${ticket}\u001b[22m`,
    ],
    state: place.state ?? '\u001b[90maguardando\u001b[39m',
    order: AGENT_ORDER + place.at / 100,
    joined: place.at > 0,
    color,
    stripe: color,
  };
}
