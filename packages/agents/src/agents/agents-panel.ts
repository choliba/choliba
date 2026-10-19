import { messageOf, type ChatPanel, type PanelCommand } from '@choliba/core';

import type { AgentDefinition } from '../common';
import { listAgents } from './agent-loader';
import { agentPaint } from './agents-panel-card';
import { chooseAgentRun, runChoices } from './agents-panel-choices';
import { RESUME_AT, resumeSequence, talkToAgent } from './agents-panel-run';
import { AGENT, agentsDir, sessionAgentIds, showRun } from './agents-panel-state';

/** The option that ends the sequence, first and checked: Enter after the first agent keeps it alone. */
const NO_OTHER = 'nenhum outro';

/**
 * Picks the agents after `first`, in order: each choice is `added` at the end of the sequence, among those not in it
 * yet, when it takes the place (`added` gives `true`); Enter on "nenhum outro" or Esc ends it.
 */
async function sequenceAfter(
  first: AgentDefinition,
  agents: readonly AgentDefinition[],
  panel: ChatPanel,
  added: (sequence: readonly AgentDefinition[], agent: AgentDefinition) => Promise<boolean>,
): Promise<void> {
  const sequence = [first];
  if (!(await added(sequence, first))) return;
  for (;;) {
    const left = agents.filter((agent) => !sequence.includes(agent));
    if (left.length === 0) return;
    const chosen = await panel.choose({
      title: `Depois de ${sequence.map((agent) => agent.id).join(' >>> ')}`,
      description: 'O próximo agente da sequência, que roda quando o anterior termina e você confirma.',
      options: [
        { label: NO_OTHER, detail: 'a sequência fica como está', current: true },
        ...left.map((agent) => ({ label: agent.id, detail: agent.description, current: false })),
      ],
    });
    const next = chosen === undefined ? undefined : left[chosen - 1];
    if (next === undefined) return;
    sequence.push(next);
    if (!(await added(sequence, next))) sequence.pop();
  }
}

/**
 * `/agents`: the session's agents, chosen among the workspace's: the first, then those that run after it, in order
 * (one is a run of that agent alone). Each one picked chooses its provider and its model, or takes the panel's, and
 * enters with its card in the header as soon as it can run; then what is sent with no `/` is the first one's task.
 */
const agentsPanelCommand: PanelCommand = {
  name: 'agents',
  description: 'Escolhe o agente que vai trabalhar, ou vários em sequência',
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
    const [active] = sessionAgentIds(context);
    const chosen = await panel.choose({
      title: 'Escolha o agente',
      description: 'O agente que vai trabalhar no projeto e no ticket ativos; depois, os que seguem.',
      options: agents.map((agent) => ({ label: agent.id, detail: agent.description, current: agent.id === active })),
    });
    const first = chosen === undefined ? undefined : agents[chosen];
    if (first === undefined) return;
    const before = context.get(AGENT);
    // Each agent's provider and model are its own, kept if chosen before; the mode stays (a mode an agent does not
    // take gives way to its default).
    talkToAgent(container, context);
    // Each agent picked chooses its provider and its model, then enters, with its card, or stays out.
    await sequenceAfter(first, agents, panel, async (sequence, agent) => {
      if (!(await chooseAgentRun(container, context, panel, agent))) return false;
      context.set(AGENT, sequence.map((each) => each.id).join(','));
      panel.write(`Agente ${agentPaint(container, agent)(agent.id)} adicionado.`);
      showRun(container, context, panel);
      return true;
    });
    // Another sequence has nothing to resume.
    if (context.get(AGENT) !== before) context.set(RESUME_AT, undefined);
  },
};

/** `/seguir`: resumes the sequence that stopped, from the agent where it stopped. */
const resumeCommand: PanelCommand = {
  name: 'seguir',
  description: 'Retoma a sequência de agentes de onde ela parou',
  unavailable: (context) =>
    context.get(RESUME_AT) === undefined ? 'Nenhuma sequência parada para retomar' : undefined,
  run: ({ panel, context }) => {
    resumeSequence(context, panel);
    return Promise.resolve();
  },
};

/** What @choliba/agents brings to `choliba panel`. */
export const agentsPanel: readonly PanelCommand[] = [agentsPanelCommand, resumeCommand, ...runChoices];
