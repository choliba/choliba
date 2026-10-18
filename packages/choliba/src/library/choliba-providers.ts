import { agentRunChoice, type AgentDefinition, type AgentProvider, type ProviderRegistry } from '@choliba/agents';
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
    needsModel: provider.needsModel,
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
 * The provider that runs `agent` with no `--provider`, as `choliba run agent` picks it among the providers the agent
 * declares: the preference when the agent declares it, and under `auto` the first declared that is installed;
 * `undefined` when none can run it.
 */
export function agentRunsWith(source: ProvidersSource, agent: AgentDefinition): CholibaProvider | undefined {
  const which = (bin: string): string | null => commandOnPath(bin, source.path()) ?? null;
  const run = agentRunChoice(agent, { preference: source.preferred() }, source.registry, which);
  return 'error' in run ? undefined : providerOf(source, run.resolved.adapter);
}
