import type { AgentDefinition, ProviderRegistry } from '../common';

/**
 * The provider the agent itself asks for, by id, or nothing. Today it is the one every model the agent declares
 * belongs to (all `ollama:…` are `claude-ollama`'s), as only that provider runs them; a model of no prefix, or models
 * of different providers, ask for none. When `agent.yaml` declares its provider(s), they come first here, and the
 * models only without them. It depends on the agent alone, never on a session: each agent has its own.
 */
export function agentProvider(
  agent: Pick<AgentDefinition, 'supportedModels'>,
  registry: Pick<ProviderRegistry, 'modelOwner'>,
): string | undefined {
  const owners = new Set(agent.supportedModels.map((model) => registry.modelOwner(model)?.id));
  return owners.size === 1 ? [...owners][0] : undefined;
}
