import {
  ClaudeAgentProvider,
  ClaudeOllamaAgentProvider,
  CodexAgentProvider,
  CursorAgentProvider,
} from '@choliba/providers';

import { ProviderRegistry } from '../../agents/common/provider-registry';

export const claudeProvider = new ClaudeAgentProvider();
export const cursorProvider = new CursorAgentProvider();
export const codexProvider = new CodexAgentProvider();
export const claudeOllamaProvider = new ClaudeOllamaAgentProvider();

/** The registry the app builds from the providers it finds: claude, codex and cursor. */
export const PROVIDERS = new ProviderRegistry([claudeProvider, codexProvider, cursorProvider]);

/** The same, with claude-ollama, which runs only when named. */
export const PROVIDERS_WITH_OLLAMA = new ProviderRegistry([
  claudeProvider,
  claudeOllamaProvider,
  codexProvider,
  cursorProvider,
]);
