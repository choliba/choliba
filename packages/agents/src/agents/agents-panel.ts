import { messageOf, type PanelCommand } from '@choliba/core';

import { listAgents } from './agent-loader';
import { agentPaint } from './agents-panel-card';
import { runChoices } from './agents-panel-choices';
import { talkToAgent } from './agents-panel-run';
import { AGENT, agentsDir, listenModeKey, MODE, MODEL, showRun } from './agents-panel-state';

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
    panel.write(`Agente ativo: ${agentPaint(container, agent)(agent.id)}.`);
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
