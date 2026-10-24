import { type AgentDefinition } from '@choliba/domain';
import {
  AGENT,
  RESUME_AT,
  agentSequenceState,
  agentPaint,
  agentsDir,
  resumeSequence,
  sessionAgentIds,
  showRun,
  talkToAgent,
  warn,
} from '../agents';
import { listAgents } from '@choliba/engine';
import type { Container } from '@choliba/kernel';
import { messageOf, type ChatPanel, type PanelCommand, type PanelContext } from '@choliba/shell';

import { chooseAgentRun, runChoices } from './agents-panel-choices';

/** The option that ends the additions, first and checked: Enter after an agent keeps the sequence as it is. */
const NO_OTHER = 'nenhum outro';

/** An agent's name in its color, as the panel says it. */
function named(container: Container, agent: AgentDefinition): string {
  return agentPaint(container, agent)(agent.id);
}

/**
 * Adds `agent` at the end of the session's sequence, once it has chosen its provider and its model; one that cannot
 * take them stays out, saying why.
 */
async function addAgent(
  container: Container,
  context: PanelContext,
  panel: ChatPanel,
  agent: AgentDefinition,
): Promise<void> {
  const refused = await chooseAgentRun(container, context, panel, agent);
  if (refused !== undefined) {
    panel.write(warn(`O agente ${agent.id} não entra: ${refused}`));
    return;
  }
  context.set(AGENT, [...sessionAgentIds(context), agent.id].join(','));
  panel.write(`Agente ${named(container, agent)} adicionado.`);
  showRun(container, context, panel);
}

/** Changes the provider and the model of `agent`, in the sequence already: not while it runs. */
async function changeAgent(
  container: Container,
  context: PanelContext,
  panel: ChatPanel,
  agent: AgentDefinition,
): Promise<void> {
  if (agentSequenceState(context)?.current === agent.id) {
    panel.write(warn(`O agente ${agent.id} está rodando: troque o provider e o modelo dele depois que terminar.`));
    return;
  }
  const refused = await chooseAgentRun(container, context, panel, agent);
  if (refused !== undefined) {
    panel.write(warn(`O agente ${agent.id} fica como estava: ${refused}`));
    return;
  }
  panel.write(`Agente ${named(container, agent)} atualizado.`);
  showRun(container, context, panel);
}

/** Asks for the agents to add after the sequence, one at a time, until "nenhum outro" or Esc. */
async function addMore(
  container: Container,
  context: PanelContext,
  panel: ChatPanel,
  agents: readonly AgentDefinition[],
): Promise<void> {
  for (;;) {
    const sequence = sessionAgentIds(context);
    const left = agents.filter((agent) => !sequence.includes(agent.id));
    if (sequence.length === 0 || left.length === 0) return;
    const chosen = await panel.choose({
      title: `Depois de ${sequence.join(' → ')}`,
      description: 'O próximo agente da sequência, que roda quando o anterior termina e você confirma.',
      options: [
        { label: NO_OTHER, detail: 'a sequência fica como está', current: true },
        ...left.map((agent) => ({ label: agent.id, detail: agent.description, current: false })),
      ],
    });
    const next = chosen === undefined ? undefined : left[chosen - 1];
    if (next === undefined) return;
    await addAgent(container, context, panel, next);
  }
}

/**
 * `/agents`: the session's agents, among the workspace's, which it never starts over (/clear does). One already in the
 * sequence (checked) chooses its provider and its model again, unless it runs now; another is added at its end, after
 * choosing them, and then the ones after it, in order. Each one enters with its card in the header as soon as it can
 * run, even while the sequence goes; what is sent with no `/` is the first one's task.
 */
const agentsPanelCommand: PanelCommand = {
  name: 'agents',
  description: 'Acrescenta agentes à sequência, ou troca o provider e o modelo de um',
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
    const sequence = sessionAgentIds(context);
    const chosen = await panel.choose({
      title: 'Escolha o agente',
      description: 'Um agente da sequência (marcado) troca o provider e o modelo; outro entra no fim dela.',
      options: agents.map((agent) => ({
        label: agent.id,
        detail: agent.description,
        current: sequence.includes(agent.id),
      })),
    });
    const agent = chosen === undefined ? undefined : agents[chosen];
    if (agent === undefined) return;
    talkToAgent(container, context);
    if (sequence.includes(agent.id)) {
      await changeAgent(container, context, panel, agent);
      return;
    }
    await addAgent(container, context, panel, agent);
    await addMore(container, context, panel, agents);
  },
};

/**
 * `/resume`: goes back to an agent of the sequence (where it stopped, checked) and runs it again from there, with the
 * session's ticket: what is typed is said to that agent, and an empty line or Esc repeats its task.
 */
const resumeCommand: PanelCommand = {
  name: 'resume',
  description: 'Volta a um agente da sequência e segue dela',
  unavailable: (context) => {
    if (sessionAgentIds(context).length === 0) return 'Escolha os agentes antes, com /agents';
    return agentSequenceState(context)?.running === true
      ? 'Os agentes estão rodando: espere terminar ou pare com Ctrl+C'
      : undefined;
  },
  run: async ({ container, panel, context }) => {
    const ids = sessionAgentIds(context);
    // Where it stopped, checked; a sequence that ended has none.
    const stopped = agentSequenceState(context)?.resumeAt ?? Number(context.get(RESUME_AT));
    const chosen = await panel.choose({
      title: 'Voltar a qual agente?',
      description: 'A sequência roda de novo a partir dele, com o ticket da sessão.',
      options: ids.map((id, at) => ({ label: id, detail: '', current: at === stopped })),
    });
    if (chosen === undefined) return;
    const reply = await panel.ask({
      question: `O que dizer a ${String(ids[chosen])}? Vazio ou Esc repete a tarefa dele.`,
      options: [],
      multi: false,
    });
    const said = reply.status === 'answered' && typeof reply.answer === 'string' ? reply.answer.trim() : '';
    talkToAgent(container, context);
    resumeSequence(context, panel, chosen, said === '' ? undefined : said);
  },
};

/** The agent commands the TUI brings to `choliba panel`. */
export const agentsPanel: readonly PanelCommand[] = [agentsPanelCommand, resumeCommand, ...runChoices];
