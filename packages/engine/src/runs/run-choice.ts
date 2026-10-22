import type { AgentDefinition } from '@choliba/domain';

import { AUTO, type ProviderRegistry, type ResolvedProvider } from '../ports';

/** The provider and the model a run takes, as the agent's `providers` allow. */
export interface RunChoice {
  readonly resolved: ResolvedProvider;
  /** The model asked of the provider, one the agent declares for it. */
  readonly model: string;
}

/** What a run asks for: `--provider`, `--model`, and `CHOL_AGENTS_PROVIDER`. */
export interface RunAsk {
  readonly provider?: string | undefined;
  readonly model?: string | undefined;
  readonly preference?: string | undefined;
}

type Choice<T> = T | { readonly error: string };

/** The models `agent` declares for the provider `id`, or none when it does not declare that provider. */
export function declaredModels(agent: Pick<AgentDefinition, 'providers'>, id: string): readonly string[] {
  return agent.providers.find((provider) => provider.id === id)?.models ?? [];
}

/** `claude: a, b · cursor: c`: what the agent declares, for a message. */
function declaredText(agent: Pick<AgentDefinition, 'providers'>): string {
  return agent.providers.map(({ id, models }) => `${id}: ${models.join(', ')}`).join(' · ');
}

function declaredIds(agent: Pick<AgentDefinition, 'providers'>): string {
  return agent.providers.map(({ id }) => id).join(', ');
}

/** The provider `id`, which the agent must declare, on this machine. */
function declaredProvider(
  agent: AgentDefinition,
  id: string,
  registry: ProviderRegistry,
  which: (bin: string) => string | null,
): Choice<ResolvedProvider> {
  if (!agent.providers.some((provider) => provider.id === id)) {
    return { error: `O agente ${agent.id} não declara o provider ${id} (declara: ${declaredIds(agent)}).` };
  }
  try {
    return registry.resolve(id, which);
  } catch {
    return { error: `O provider ${id} não está instalado nesta máquina.` };
  }
}

/** Under `auto`, the first provider the agent declares that is installed, in the file's order. */
function firstInstalled(
  agent: AgentDefinition,
  registry: ProviderRegistry,
  which: (bin: string) => string | null,
): Choice<ResolvedProvider> {
  for (const { id } of agent.providers) {
    try {
      return registry.resolve(id, which);
    } catch {
      // Not installed: the next one the agent declares.
    }
  }
  return { error: `Nenhum provider que o agente ${agent.id} declara está instalado: ${declaredIds(agent)}.` };
}

/** Why `model` cannot run: no provider of the agent declares it. */
export function undeclaredModel(agent: Pick<AgentDefinition, 'id' | 'providers'>, model: string): string {
  return `O modelo ${model} não está declarado no agente ${agent.id} (${declaredText(agent)}).`;
}

/** The provider that declares `model`, the only one; none declaring it, or two, is said instead. */
function modelOwner(agent: AgentDefinition, model: string): Choice<string> {
  const owners = agent.providers.filter(({ models }) => models.includes(model)).map(({ id }) => id);
  const [owner, other] = owners;
  if (owner === undefined) return { error: undeclaredModel(agent, model) };
  if (other !== undefined) {
    return { error: `O modelo ${model} está declarado em ${owners.join(' e ')}: diga qual com --provider.` };
  }
  return owner;
}

/** The provider of the run: `--provider`, else the owner of `--model`, else the preference among the declared ones. */
function chosenProvider(
  agent: AgentDefinition,
  ask: RunAsk,
  registry: ProviderRegistry,
  which: (bin: string) => string | null,
): Choice<ResolvedProvider> {
  const owner = ask.provider === undefined && ask.model !== undefined ? modelOwner(agent, ask.model) : undefined;
  if (typeof owner === 'object') return owner;
  // A name no provider has is refused as such, before asking whether the agent declares it.
  const id = registry.parsePreference(ask.provider ?? owner ?? ask.preference);
  return id === AUTO ? firstInstalled(agent, registry, which) : declaredProvider(agent, id, registry, which);
}

/**
 * The model asked of `resolved`: `--model`, which it must declare, else the first one it declares. Never the
 * provider's own default, which the run would refuse as a model the agent does not declare.
 */
function chosenModel(agent: AgentDefinition, resolved: ResolvedProvider, model: string | undefined): Choice<string> {
  const { id } = resolved.adapter;
  const models = declaredModels(agent, id);
  if (model !== undefined) {
    return models.includes(model)
      ? model
      : { error: `O modelo ${model} não está entre os de ${id} no agente ${agent.id} (${models.join(', ')}).` };
  }
  const [first] = models;
  return first ?? { error: `O agente ${agent.id} não declara nenhum modelo para ${id}.` };
}

/**
 * The provider and the model a run of `agent` takes, from what it declares (`providers`):
 *
 * - `--provider`, which the agent must declare; else the provider that declares `--model` (two declaring it is
 *   refused, asking for `--provider`); else `CHOL_AGENTS_PROVIDER`, which the agent must declare, and under `auto` the
 *   first declared provider that is installed;
 * - `--model`, which that provider must declare; else its first declared model.
 *
 * What cannot run is said in Portuguese, naming what the agent declares.
 */
export function agentRunChoice(
  agent: AgentDefinition,
  ask: RunAsk,
  registry: ProviderRegistry,
  which: (bin: string) => string | null,
): Choice<RunChoice> {
  let provider: ReturnType<typeof chosenProvider>;
  try {
    provider = chosenProvider(agent, ask, registry, which);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if ('error' in provider) return provider;
  const model = chosenModel(agent, provider, ask.model);
  if (typeof model === 'object') return model;
  return { resolved: provider, model };
}
