import { ProviderRegistry } from '@choliba/engine';

import { ClaudeAgentProvider, ClaudeOllamaAgentProvider } from '../claude';
import { CodexAgentProvider } from '../codex';
import { CursorAgentProvider } from '../cursor';

/** The providers choliba knows: adding one is adding its class here. */
export function knownProviders(): ProviderRegistry {
  return new ProviderRegistry([
    new ClaudeAgentProvider(),
    new ClaudeOllamaAgentProvider(),
    new CodexAgentProvider(),
    new CursorAgentProvider(),
  ]);
}
