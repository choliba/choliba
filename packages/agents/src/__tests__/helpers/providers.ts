import { ClaudeAgentProvider } from '../../providers/claude/claude-agent.provider';
import { ClaudeOllamaAgentProvider } from '../../providers/claude/claude-ollama-agent.provider';
import { CursorAgentProvider } from '../../providers/cursor/cursor-agent.provider';
import { ProviderRegistry } from '../../common/provider-registry';

export const claudeProvider = new ClaudeAgentProvider();
export const cursorProvider = new CursorAgentProvider();
export const claudeOllamaProvider = new ClaudeOllamaAgentProvider();

/** The registry the app builds from the providers it finds: claude and cursor. */
export const PROVIDERS = new ProviderRegistry([claudeProvider, cursorProvider]);

/** The same, with claude-ollama, the provider that runs only `ollama:` models. */
export const PROVIDERS_WITH_OLLAMA = new ProviderRegistry([claudeProvider, claudeOllamaProvider, cursorProvider]);
