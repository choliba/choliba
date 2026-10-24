import { type AgentDefinition } from '@choliba/domain';
import {
  AGENT,
  RESUME_AT,
  agentSequenceState,
  agentPaint,
  agentsDir,
  confirmTask,
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
import { moveAgentTo, removeAgent } from './agents-panel-order';

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

/**
 * What to do with an agent already in the sequence: choose its provider and model again, move it one place either way,
 * or take it out. Moving and taking out wait for the agents to stop running.
 */
async function editAgent(
  container: Container,
  context: PanelContext,
  panel: ChatPanel,
  agent: AgentDefinition,
): Promise<void> {
  const ids = sessionAgentIds(context);
  const at = ids.indexOf(agent.id);
  const before = ids[at - 1];
  const after = ids[at + 1];
  const move = (to: number) => (): void => {
    moveAgentTo(container, context, agent.id, to, panel);
  };
  const actions: readonly { readonly label: string; readonly act: () => Promise<void> | void }[] = [
    { label: 'Trocar o provider e o modelo', act: () => changeAgent(container, context, panel, agent) },
    ...(before === undefined ? [] : [{ label: `Mover para antes de ${before}`, act: move(at - 1) }]),
    ...(after === undefined ? [] : [{ label: `Mover para depois de ${after}`, act: move(at + 1) }]),
    {
      label: 'Tirar da sequência',
      act: () => {
        removeAgent(container, context, agent.id, panel);
      },
    },
  ];
  const chosen = await panel.choose({
    title: `O que fazer com ${agent.id}?`,
    description: 'Ele já está na sequência.',
    options: actions.map((action) => ({ label: action.label })),
  });
  await (chosen === undefined ? undefined : actions[chosen]?.act());
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
 * sequence (checked) chooses its provider and its model again, unless it runs now, moves one place or leaves it;
 * another is added at its end, after choosing them, and then the ones after it, in order. Each one enters with its card in the header as soon as it can
 * run, even while the sequence goes; what is sent with no `/` is the first one's task.
 */
const agentsPanelCommand: PanelCommand = {
  name: 'agents',
  description: 'Acrescenta agentes à sequência, ou troca, move ou tira um dela',
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
      description: 'Um agente da sequência (marcado) se troca, se move ou sai dela; outro entra no fim dela.',
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
      await editAgent(container, context, panel, agent);
      return;
    }
    await addAgent(container, context, panel, agent);
    await addMore(container, context, panel, agents);
  },
};

/**
 * `/resume [texto]`: goes back to an agent of the sequence (where it stopped, checked) and runs it again from there,
 * with the session's ticket: the text typed after it, or else what is answered to its question, is said to that agent,
 * and an empty answer or Esc repeats its task.
 */
const resumeCommand: PanelCommand = {
  name: 'resume',
  description: 'Volta a um agente da sequência e segue dela',
  takesText: true,
  unavailable: (context) => {
    if (sessionAgentIds(context).length === 0) return 'Escolha os agentes antes, com /agents';
    return agentSequenceState(context)?.running === true
      ? 'Os agentes estão rodando: espere terminar ou pare com Ctrl+C'
      : undefined;
  },
  run: async ({ container, panel, context, text }) => {
    const ids = sessionAgentIds(context);
    // Where it stopped, checked; a sequence that ended has none.
    const stopped = agentSequenceState(context)?.resumeAt ?? Number(context.get(RESUME_AT));
    const chosen = await panel.choose({
      title: 'Voltar a qual agente?',
      description: 'A sequência roda de novo a partir dele, com o ticket da sessão.',
      options: ids.map((id, at) => ({ label: id, detail: '', current: at === stopped })),
    });
    if (chosen === undefined) return;
    // What was typed after /resume is what is said; without it, the panel asks.
    const said = text?.trim() ?? (await whatToSay(panel, String(ids[chosen])));
    if (said !== '' && !(await confirmTask(panel, said))) return;
    talkToAgent(container, context);
    resumeSequence(context, panel, chosen, said === '' ? undefined : said);
  },
};

/** What to say to `agent`, gone back to: what is typed, or nothing (empty or Esc) to repeat its task. */
async function whatToSay(panel: ChatPanel, agent: string): Promise<string> {
  const reply = await panel.ask({
    question: `O que dizer a ${agent}? Vazio ou Esc repete a tarefa dele.`,
    options: [],
    multi: false,
  });
  return reply.status === 'answered' && typeof reply.answer === 'string' ? reply.answer.trim() : '';
}

/** The agent commands the TUI brings to `choliba panel`. */
export const agentsPanel: readonly PanelCommand[] = [agentsPanelCommand, resumeCommand, ...runChoices];
