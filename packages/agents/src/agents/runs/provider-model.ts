import type { AgentProvider, ProviderRegistry } from '../../common';

/** The model a run asks its provider for, or why the provider cannot run the one asked. */
export type ProviderModel = { readonly model: string | undefined } | { readonly error: string };

/** Why `provider` does not run `model`: the model is another provider's, or lacks this one's prefix. */
function foreignModel(provider: AgentProvider, model: string, registry: ProviderRegistry): string | undefined {
  const owner = registry.modelOwner(model);
  if (owner !== undefined && owner !== provider) {
    return `O modelo "${model}" é do provider ${owner.id}: rode com --provider ${owner.id}.`;
  }
  if (provider.modelPrefix !== undefined && owner === undefined) {
    return `O provider ${provider.id} só roda modelos ${provider.modelPrefix}<modelo>; "${model}" não é um deles.`;
  }
  return undefined;
}

/**
 * The model a run asks `provider` for: the explicit `--model` when the provider runs it, or, for a provider that runs
 * only models of its own prefix, the first of them the agent declares (`agent.yaml#models`). Any other provider
 * without `--model` asks for none, as before, and its own default is checked once the stream reports it.
 */
export function providerModel(
  provider: AgentProvider,
  explicit: string | undefined,
  declared: readonly string[],
  registry: ProviderRegistry,
): ProviderModel {
  if (explicit !== undefined) {
    const error = foreignModel(provider, explicit, registry);
    return error === undefined ? { model: explicit } : { error };
  }
  const prefix = provider.modelPrefix;
  if (prefix === undefined) return { model: undefined };
  const own = declared.find((model) => model.startsWith(prefix));
  if (own !== undefined) return { model: own };
  return {
    error: `O provider ${provider.id} roda um modelo declarado como ${prefix}<modelo> em agent.yaml#models, e o agente não declara nenhum.`,
  };
}
