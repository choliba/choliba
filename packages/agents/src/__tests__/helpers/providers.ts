import { ClaudeAgentProvider } from '../../providers/claude/claude-agent.provider';
import { CursorAgentProvider } from '../../providers/cursor/cursor-agent.provider';
import { ProviderRegistry } from '../../providers/provider-registry';

export const claudeProvider = new ClaudeAgentProvider();
export const cursorProvider = new CursorAgentProvider();

/** The registry the app builds from the providers it finds: claude and cursor. */
export const PROVIDERS = new ProviderRegistry([claudeProvider, cursorProvider]);
