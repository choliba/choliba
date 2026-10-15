import { CARD_RULE, messageOf, WORKSPACE_ROOT, type Container, type PanelCommand } from '@choliba/core';

import type { AgentDefinition } from '../common';
import { resolveAgentsDir } from './agent-dirs';
import { listAgents } from './agent-loader';
import { agentsConfig } from './agents-config';

/** The context key and the card's title in the panel's header. */
const AGENT = 'agente';

/** The workspace's agents folder, as `choliba run agent` finds it: `CHOL_AGENTS_DIR`, else `.choliba/agents`. */
function agentsDir(container: Container): string {
  return resolveAgentsDir(
    undefined,
    { CHOL_AGENTS_DIR: container.get(agentsConfig.token).agentsDir },
    container.get(WORKSPACE_ROOT),
  );
}

/** What a run of the agent needs: a project and a ticket, a project, or nothing. */
function needs(agent: AgentDefinition): string {
  if (!agent.projectRequired) return 'sem projeto';
  return agent.ticketTypes === undefined || agent.allowWithoutTicket ? 'projeto' : 'projeto e ticket';
}

/**
 * The agent's card: its name and version, what it does, and what it needs and the models it takes; collapsed, its id
 * and version.
 */
function agentCard(agent: AgentDefinition): { readonly lines: readonly string[]; readonly summary: string } {
  const version = `\u001b[90m${agent.version}\u001b[39m`;
  // The agent.yaml standard asks for at least one model.
  const models = ` · ${agent.supportedModels.join(', ')}`;
  return {
    lines: [
      `\u001b[1m\u001b[36m${agent.displayName}\u001b[39m\u001b[22m ${version}`,
      CARD_RULE,
      agent.description,
      CARD_RULE,
      `\u001b[90m${needs(agent)}${models}\u001b[39m`,
    ],
    summary: `\u001b[1m\u001b[36m${agent.id}\u001b[39m\u001b[22m ${version}`,
  };
}

/** `/agents`: the active agent, chosen among the workspace's; it only chooses, nothing runs. */
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
    const card = agentCard(agent);
    context.show(AGENT, { ...card, key: 'a' });
    panel.write(`Agente ativo: \u001b[1m${agent.id}\u001b[22m.`);
  },
};

/** What @choliba/agents brings to `choliba panel`. */
export const agentsPanel: readonly PanelCommand[] = [agentsPanelCommand];
