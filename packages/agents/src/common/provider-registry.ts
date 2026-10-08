import type { AgentProvider } from './agent-provider';

/** `--provider` (or `CHOL_AGENTS_PROVIDER`) when it says nothing: the first provider installed. */
export const AUTO = 'auto';

export interface ResolvedProvider {
  readonly adapter: AgentProvider;
  /** The full binary command, e.g. `['cursor-agent']` or `['cursor', 'agent']`. */
  readonly command: readonly string[];
}

export class InvalidProviderPreferenceError extends Error {}
export class ProviderNotFoundError extends Error {}

/** `a, b or c`. */
function listWithOr(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${String(items.at(-1))}`;
}

/** The first candidate in `provider.binaries` whose first word resolves, in declared order. */
function findCommand(provider: AgentProvider, which: (bin: string) => string | null): readonly string[] | undefined {
  return provider.binaries.find((candidate) => {
    const bin = candidate[0];
    return bin !== undefined && which(bin) !== null;
  });
}

/** How a provider is found: its command, or — when installs name it differently — the first of them installed. */
function commandsOf(provider: AgentProvider): string {
  const names = provider.binaries.map((binary) => `\`${binary.join(' ')}\``);
  if (names.length === 1) {
    return `Comando ${names.join('')}.`;
  }
  return `Comando ${names.slice(0, -1).join(', ')} ou ${names.slice(-1).join('')}, o primeiro que estiver instalado.`;
}

/**
 * The providers choliba knows (found, not listed by hand): the names `--provider` takes, `auto`'s search
 * order, and the binary a run talks to.
 */
export class ProviderRegistry {
  private readonly providers: readonly AgentProvider[];

  constructor(providers: readonly AgentProvider[]) {
    this.providers = [...providers].sort((a, b) => a.id.localeCompare(b.id));
  }

  /** `auto` and every provider's id: what `--provider` and the `--<id>` shortcuts take. */
  choices(): readonly string[] {
    return [AUTO, ...this.providers.map((provider) => provider.id)];
  }

  /** What each `--provider` value means, listed under `--provider` in `--help`. */
  descriptions(): readonly { readonly name: string; readonly description: string }[] {
    const order = this.autoOrder().map((provider) => provider.id);
    return [
      { name: AUTO, description: `O primeiro instalado, nesta ordem: ${order.join(', ')}.` },
      ...this.providers.map((provider) => ({ name: provider.id, description: commandsOf(provider) })),
    ];
  }

  /** `raw` as a choice: `auto` when absent; throws for a name no provider has. */
  parsePreference(raw: string | undefined): string {
    if (raw === undefined || this.choices().includes(raw)) {
      return raw ?? AUTO;
    }
    throw new InvalidProviderPreferenceError(`unknown provider "${raw}" (expected ${listWithOr(this.choices())})`);
  }

  /**
   * The provider `preference` names, or under `auto` the first installed in `autoPriority` order, with the
   * binary to run. `which` is `Bun.which` in production and a table in specs.
   */
  resolve(preference: string, which: (bin: string) => string | null): ResolvedProvider {
    const candidates =
      preference === AUTO ? this.autoOrder() : this.providers.filter((provider) => provider.id === preference);
    for (const adapter of candidates) {
      const command = findCommand(adapter, which);
      if (command !== undefined) {
        return { adapter, command };
      }
    }
    const tried = candidates.map((provider) => provider.id).join(', ');
    throw new ProviderNotFoundError(`no working binary found for ${preference} (tried: ${tried})`);
  }

  private autoOrder(): readonly AgentProvider[] {
    return [...this.providers].sort((a, b) => a.autoPriority - b.autoPriority);
  }
}
