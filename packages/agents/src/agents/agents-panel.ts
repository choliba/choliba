import { boldAnsi, CARD_RULE, messageOf, paintAnsi, THEME, type PanelCommand } from '@choliba/core';

import type { AgentDefinition } from '../common';
import { listAgents } from './agent-loader';
import { runChoices } from './agents-panel-choices';
import { talkToAgent } from './agents-panel-run';
import { AGENT, agentsDir, listenModeKey, MODE, MODEL, showRun } from './agents-panel-state';

/** What a run of the agent needs: a project and a ticket, a project, or nothing. */
function needs(agent: AgentDefinition): string {
  if (!agent.projectRequired) return 'sem projeto';
  return agent.ticketTypes === undefined || agent.allowWithoutTicket ? 'projeto' : 'projeto e ticket';
}

/**
 * The agent's card: its name (`painted` in its color) and version, what it does, and what it needs and the models it
 * takes; collapsed, its id and version.
 */
function agentCard(
  agent: AgentDefinition,
  painted: (text: string) => string,
): { readonly lines: readonly string[]; readonly summary: string } {
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
    summary: `${painted(agent.id)} ${version}`,
  };
}

/** `/agents`: the active agent, chosen among the workspace's; then what is sent with no `/` is its task. */
const agentsPanelCommand: PanelCommand = {
  name: 'agents',
  description: 'Escolhe o agente que vai trabalhar',
  unavailable: (_context, container) => {
    try {
      return listAgents(agentsDir(container)).length === 0
        ? 'Nenhum agente na pasta de agentes. Traga um com `choliba add`'
        : undefined;
    } catch (error) {
      return messageOf(error);
    }
  },
  run: async ({ container, panel, context }) => {
    const agents = listAgents(agentsDir(container));
    const active = context.get(AGENT);
    const chosen = await panel.choose({
      title: 'Escolha o agente',
      description: 'O agente que vai trabalhar no projeto e no ticket ativos.',
      options: agents.map((agent) => ({ label: agent.id, detail: agent.description, current: agent.id === active })),
    });
    const agent = chosen === undefined ? undefined : agents[chosen];
    if (agent === undefined || agent.id === active) return;
    context.set(AGENT, agent.id);
    // The agent's color, as a run paints its label: `CHOL_COLORS` first, then its `agent.color`.
    const color = container.get(THEME).colorOf('agents', agent.id, agent.color);
    const painted = (text: string): string => boldAnsi(paintAnsi(color, text));
    context.show(AGENT, { ...agentCard(agent, painted), key: 'a' });
    panel.write(`Agente ativo: ${painted(agent.id)}.`);
    // Another agent has its own models and modes: back to its defaults. The provider stays.
    context.set(MODEL, undefined);
    context.set(MODE, undefined);
    listenModeKey(container, context);
    talkToAgent(container, context);
    showRun(container, context, panel);
  },
};

/** What @choliba/agents brings to `choliba panel`. */
export const agentsPanel: readonly PanelCommand[] = [agentsPanelCommand, ...runChoices];
