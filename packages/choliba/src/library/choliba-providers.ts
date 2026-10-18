import { agentProvider, AUTO, type AgentDefinition, type AgentProvider, type ProviderRegistry } from '@choliba/agents';
import type { ConfigSource } from '@choliba/config';
import { commandOnPath, ExpectedError } from '@choliba/core';

import type { CholibaProvider, CholibaProviders } from './interfaces/choliba.interface';

/** Where a script finds the providers: the registry, the configuration's sources, and the `PATH` to look in. */
export interface ProvidersSource {
  readonly registry: ProviderRegistry;
  readonly sources: () => readonly ConfigSource[];
  /** `CHOL_AGENTS_PROVIDER` in effect. */
  readonly preferred: () => string;
  readonly path: () => string | undefined;
}

/** Whether a source sets the variable `name` (in the environment, or in the `.env`). */
function isSet(sources: readonly ConfigSource[], name: string): boolean {
  return sources.some((source) => {
    const value = source.read({ env: name, path: [] });
    return typeof value === 'string' && value !== '';
  });
}

/** `provider` as a script sees it: whether it is installed, and which of its credentials are set, never their values. */
function providerOf(source: ProvidersSource, provider: AgentProvider): CholibaProvider {
  const sources = source.sources();
  return {
    id: provider.id,
    installed: provider.binaries.some(([bin]) => commandOnPath(bin, source.path()) !== undefined),
    inAuto: provider.inAuto,
    credentials: provider.credentials.map((name) => ({ name, set: isSet(sources, name) })),
    ...(provider.modelPrefix === undefined ? {} : { modelPrefix: provider.modelPrefix }),
    summary: source.registry.summary(provider),
  };
}

/** The providers choliba knows, as the CLI finds them: `list`, `get` and the preference in effect. */
export function cholibaProviders(source: ProvidersSource): CholibaProviders {
  const providers = (): readonly AgentProvider[] => source.registry.list();
  return {
    list: () => providers().map((provider) => providerOf(source, provider)),
    get: (id) => {
      const provider = providers().find((each) => each.id === id);
      if (provider === undefined) {
        const known = providers().map((each) => each.id);
        throw new ExpectedError(`provider "${id}" não existe (existem: ${known.join(', ')})`);
      }
      return providerOf(source, provider);
    },
    get preferred() {
      return source.preferred();
    },
  };
}

/**
 * The provider that runs `agent` with no `--provider`, as `choliba run agent` picks it: the one its models belong to,
 * else the preference, and under `auto` the first installed; `undefined` when `auto` finds none.
 */
export function agentRunsWith(source: ProvidersSource, agent: AgentDefinition): CholibaProvider | undefined {
  const choice = agentProvider(agent, source.registry) ?? source.preferred();
  if (choice !== AUTO) return cholibaProviders(source).get(choice);
  try {
    const { adapter } = source.registry.resolve(AUTO, (bin) => commandOnPath(bin, source.path()) ?? null);
    return providerOf(source, adapter);
  } catch {
    // `resolve` fails only when no provider `auto` may pick is installed.
    return undefined;
  }
}
