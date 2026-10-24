import {
  AGENT,
  MODEL,
  PROVIDER,
  RESUME_AT,
  STATE,
  agentKey,
  agentPaint,
  agentSequenceState,
  resetSequenceStop,
  sessionAgent,
  sessionAgentIds,
  showRun,
  warn,
} from '../agents';
import type { Container } from '@choliba/kernel';
import type { ChatPanel, PanelContext } from '@choliba/shell';

/** Whether the sequence may change now: never while its agents run, which the panel then says. */
function changeable(context: PanelContext, panel: ChatPanel, refusal: string): boolean {
  if (agentSequenceState(context)?.running !== true) return true;
  panel.answer(warn(refusal));
  return false;
}

/** `id` painted in its agent's color, when it still loads. */
function named(container: Container, id: string): string {
  const agent = sessionAgent(container, id);
  return agent === undefined ? id : agentPaint(container, agent)(id);
}

/** Makes `ids` the session's sequence: a stopped one no longer resumes, its order changed, and the cards follow. */
function sequenced(container: Container, context: PanelContext, ids: readonly string[]): void {
  context.set(AGENT, ids.length === 0 ? undefined : ids.join(','));
  resetSequenceStop(context);
  context.set(RESUME_AT, undefined);
  showRun(container, context);
}

/** Moves the agent `id` to `to` in the session's sequence, and says the new order. Not while the agents run. */
export function moveAgentTo(
  container: Container,
  context: PanelContext,
  id: string,
  to: number,
  panel: ChatPanel,
): void {
  if (!changeable(context, panel, 'A ordem dos agentes não muda enquanto eles rodam.')) return;
  const ids = [...sessionAgentIds(context)];
  if (!ids.includes(id) || to < 0 || to >= ids.length) return;
  ids.splice(ids.indexOf(id), 1);
  ids.splice(to, 0, id);
  sequenced(container, context, ids);
  panel.answer(
    `Agente ${named(container, id)} movido. Ordem: ${ids.map((each) => named(container, each)).join(' → ')}.`,
  );
}

/**
 * Moves the agent `id` to the place of `onto` in the session's sequence, as its card was dragged onto the other's; a
 * stopped sequence no longer resumes, its order changed. Not while the agents run.
 */
export function moveAgent(
  container: Container,
  context: PanelContext,
  id: string,
  onto: string,
  panel: ChatPanel,
): void {
  moveAgentTo(container, context, id, sessionAgentIds(context).indexOf(onto), panel);
}

/**
 * Takes the agent `id` out of the session's sequence, with the provider, the model and the state kept for it, and says
 * what is left. Not while the agents run.
 */
export function removeAgent(container: Container, context: PanelContext, id: string, panel: ChatPanel): void {
  if (!changeable(context, panel, 'Um agente não sai da sequência enquanto os agentes rodam.')) return;
  const ids = sessionAgentIds(context).filter((each) => each !== id);
  for (const key of [PROVIDER, MODEL, STATE] as const) context.set(agentKey(key, id), undefined);
  sequenced(container, context, ids);
  const left =
    ids.length === 0 ? 'A sequência ficou vazia.' : `Ordem: ${ids.map((each) => named(container, each)).join(' → ')}.`;
  panel.answer(`Agente ${named(container, id)} tirado da sequência. ${left}`);
}
