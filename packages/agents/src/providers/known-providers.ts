import { ProviderRegistry } from '../common';
import { ClaudeAgentProvider } from './claude/claude-agent.provider';
import { ClaudeOllamaAgentProvider } from './claude/claude-ollama-agent.provider';
import { CodexAgentProvider } from './codex/codex-agent.provider';
import { CursorAgentProvider } from './cursor/cursor-agent.provider';

/** The providers choliba knows: adding one is adding its class here. */
export function knownProviders(): ProviderRegistry {
  return new ProviderRegistry([
    new ClaudeAgentProvider(),
    new ClaudeOllamaAgentProvider(),
    new CodexAgentProvider(),
    new CursorAgentProvider(),
  ]);
}
