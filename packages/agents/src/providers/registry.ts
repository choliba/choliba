import { claudeProvider } from './claude';
import { cursorProvider } from './cursor';
import type { ProviderAdapter, ProviderId } from './provider.types';

export type ProviderPreference = ProviderId | 'auto';

export interface ResolvedProvider {
  readonly adapter: ProviderAdapter;
  /** The full binary command, e.g. `['cursor-agent']` or `['cursor', 'agent']`. */
  readonly command: readonly string[];
}

export class InvalidProviderPreferenceError extends Error {}
export class ProviderNotFoundError extends Error {}

export const PROVIDERS: readonly ProviderAdapter[] = [claudeProvider, cursorProvider];

/** `auto`'s search order: cursor first, then claude. */
export const AUTO_ORDER: readonly ProviderAdapter[] = [cursorProvider, claudeProvider];

export function parseProviderPreference(raw: string | undefined): ProviderPreference {
  if (raw === undefined || raw === 'auto') {
    return 'auto';
  }
  if (raw === 'claude' || raw === 'cursor') {
    return raw;
  }
  throw new InvalidProviderPreferenceError(`unknown provider "${raw}" (expected auto, claude or cursor)`);
}

/** The first candidate in `adapter.binaries` whose first word resolves, in declared order. */
function findCommand(adapter: ProviderAdapter, which: (bin: string) => string | null): readonly string[] | undefined {
  for (const candidate of adapter.binaries) {
    const bin = candidate[0];
    if (bin !== undefined && which(bin) !== null) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * `which` is injected — `Bun.which` in production, a fake table in specs — so this stays
 * testable under Jest without a real `PATH` lookup.
 */
export function resolveProvider(
  preference: ProviderPreference,
  which: (bin: string) => string | null,
): ResolvedProvider {
  const candidates = preference === 'auto' ? AUTO_ORDER : PROVIDERS.filter((adapter) => adapter.id === preference);

  for (const adapter of candidates) {
    const command = findCommand(adapter, which);
    if (command !== undefined) {
      return { adapter, command };
    }
  }

  const tried = candidates.map((adapter) => adapter.id).join(', ');
  throw new ProviderNotFoundError(`no working binary found for ${preference} (tried: ${tried})`);
}
