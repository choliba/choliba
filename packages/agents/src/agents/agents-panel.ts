import {
  CARD_RULE,
  messageOf,
  boldAnsi,
  paintAnsi,
  PLATFORM,
  THEME,
  WORKSPACE_ROOT,
  type Container,
  type PanelCommand,
  type PanelContext,
} from '@choliba/core';

import type { AgentDefinition } from '../common';
import { resolveAgentsDir } from './agent-dirs';
import { listAgents } from './agent-loader';
import { agentsConfig } from './agents-config';
import { AGENT_PROVIDERS } from './agents.constants';
import { providerModel } from './runs/provider-model';
import { AUTO } from '../common';

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

const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

/**
 * Shows in the header the provider and the model a run of `agent` would take, found as `choliba run agent` finds them:
 * `CHOL_AGENTS_PROVIDER` (`auto`, the first installed, by default) and what `agent.yaml#models` gives that provider.
 * What would stop the run shows as one word in yellow, its reason `answer`ed in the chat: the header keeps its size.
 */
function labelRun(
  container: Container,
  context: PanelContext,
  agent: AgentDefinition,
  answer: (text: string) => void,
): void {
  const registry = container.get(AGENT_PROVIDERS);
  const preference = container.get(agentsConfig.token).provider;
  let provider;
  try {
    provider = registry.resolve(preference, container.get(PLATFORM).which).adapter;
  } catch {
    context.label('provider', warn('nenhum instalado'));
    context.label('modelo', gray('—'));
    answer(warn(`Nenhum provider instalado para ${preference}: o agente não roda nesta máquina.`));
    return;
  }
  context.label('provider', `${bold(provider.id)}${preference === AUTO ? gray(' (auto)') : ''}`);
  const model = providerModel(provider, undefined, agent.supportedModels, registry);
  if ('error' in model) {
    context.label('modelo', warn('indisponível'));
    answer(warn(model.error));
    return;
  }
  context.label('modelo', model.model === undefined ? gray(`padrão do ${provider.id}`) : bold(model.model));
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
    // The agent's color, as a run paints its label: `CHOL_COLORS` first, then its `agent.color`.
    const color = container.get(THEME).colorOf('agents', agent.id, agent.color);
    const painted = (text: string): string => boldAnsi(paintAnsi(color, text));
    context.show(AGENT, { ...agentCard(agent, painted), key: 'a' });
    panel.write(`Agente ativo: ${painted(agent.id)}.`);
    labelRun(container, context, agent, (text) => {
      panel.write(text);
    });
  },
};

/** What @choliba/agents brings to `choliba panel`. */
export const agentsPanel: readonly PanelCommand[] = [agentsPanelCommand];
