import { ClaudeAgentProvider } from '../../providers/claude/claude-agent.provider';
import { ClaudeOllamaAgentProvider } from '../../providers/claude/claude-ollama-agent.provider';
import { CodexAgentProvider } from '../../providers/codex/codex-agent.provider';
import { CursorAgentProvider } from '../../providers/cursor/cursor-agent.provider';
import { ProviderRegistry } from '../../common/provider-registry';

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
