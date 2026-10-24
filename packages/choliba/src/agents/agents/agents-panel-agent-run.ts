import { declaredModels } from '@choliba/engine';
import type { AgentDefinition } from '@choliba/domain';
import type { Container } from '@choliba/kernel';
import type { ChatPanel, PanelContext } from '@choliba/shell';
import { agentKey, installedProvider, MODEL, PROVIDER, sessionRun } from './agents-panel-state';

/** Whether `choice` is installed on this machine, as the provider lists say it. */
export function installedDetail(container: Container, choice: string): string {
  return installedProvider(container, choice) === undefined ? 'não instalado' : 'instalado';
}

/**
 * The provider and the model of `agent`, chosen as it is added to the session or changed in it: its provider among
 * those it declares, then its model among those it declares for it. Esc on either leaves the panel's, which the agent
 * must then take. What it cannot take is said back, and the agent keeps the provider and the model it had; nothing
 * when it takes the ones chosen.
 */
export async function chooseAgentRun(
  container: Container,
  context: PanelContext,
  panel: ChatPanel,
  agent: AgentDefinition,
): Promise<string | undefined> {
  const keys = [agentKey(PROVIDER, agent.id), agentKey(MODEL, agent.id)] as const;
  const had = keys.map((key) => context.get(key));
  const refused = (why: string): string => {
    keys.forEach((key, index) => {
      context.set(key, had[index]);
    });
    return why;
  };
  for (const key of keys) context.set(key, undefined);
  const providers = agent.providers.map(({ id }) => id);
  const chosen = await panel.choose({
    title: `Provider de ${agent.id}`,
    description: `Quem roda ${agent.id}, entre os que ele declara. Esc usa o do painel.`,
    options: providers.map((id) => ({ label: id, detail: installedDetail(container, id), current: false })),
  });
  const provider = chosen === undefined ? undefined : providers[chosen];
  if (provider !== undefined) {
    if (installedProvider(container, provider) === undefined) {
      return refused(`o provider ${provider} não está instalado nesta máquina.`);
    }
    context.set(keys[0], provider);
  }
  const run = sessionRun(container, context, agent, { model: undefined });
  if ('error' in run) return refused(run.error);
  const adapter = run.resolved.adapter;
  // Only the ones it declares: the run refuses any other model, the provider's own default included.
  const models = declaredModels(agent, adapter.id);
  const picked = await panel.choose({
    title: `Modelo de ${agent.id}`,
    description: `Os modelos que ${agent.id} declara para ${adapter.id}. Esc usa o do painel.`,
    options: models.map((model) => ({ label: model, detail: '', current: false })),
  });
  if (picked !== undefined) context.set(keys[1], models[picked]);
  const taken = sessionRun(container, context, agent);
  return 'error' in taken ? refused(taken.error) : undefined;
}
