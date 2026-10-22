import type { ProviderVariablesInput } from '@choliba/engine';

import { ClaudeAgentProvider } from './claude-agent.provider';

const CHOL_OLLAMA_URL = 'CHOL_OLLAMA_URL';

/** Where Ollama listens when `CHOL_OLLAMA_URL` says nothing. */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/**
 * The models Claude Code picks for itself (a small one for its own short tasks, and the defaults behind its aliases):
 * all set to the run's, so no call asks Ollama for a model of Claude.
 */
/**
 * What Claude Code prints on stderr for every call to a model outside its own list (every model of Ollama): a notice
 * that it uses default limits, which says nothing to whoever runs the agent.
 */
const UNRECOGNIZED_MODEL = '[claude-code:unrecognized_model]';

const CLAUDE_MODEL_VARIABLES: readonly string[] = [
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_SMALL_FAST_MODEL',
];

/**
 * Claude Code on a model of Ollama, which answers Claude's messages API: the same session, permissions, guards and
 * parser as `claude`, with the API at `CHOL_OLLAMA_URL` and the model one the agent declares under
 * `providers.claude-ollama`. The credential is Ollama's placeholder token, and Claude's own credentials are emptied so
 * none of them reaches Ollama.
 */
export class ClaudeOllamaAgentProvider extends ClaudeAgentProvider {
  override readonly id = 'claude-ollama';
  /** Not picked by `auto` for an agent that does not declare it: it runs only the models of Ollama an agent names. */
  override readonly autoPriority = 4;
  override readonly inAuto = false;
  /** Ollama has no model of its own: a run asks for the first one the agent declares for it. */
  override readonly needsModel = true;
  override readonly summary =
    'Comando `claude`, com um modelo do Ollama (declarado em agent.yaml#providers.claude-ollama) servido em CHOL_OLLAMA_URL.';

  override quietStderr(line: string): boolean {
    return line.startsWith(UNRECOGNIZED_MODEL);
  }

  override variables(input: ProviderVariablesInput): Readonly<Record<string, string>> {
    const { request, config, reachable } = input;
    const model = request.model ?? '';
    return {
      ...super.variables(input),
      ANTHROPIC_BASE_URL: reachable(config[CHOL_OLLAMA_URL] ?? DEFAULT_OLLAMA_URL),
      ANTHROPIC_AUTH_TOKEN: 'ollama',
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_OAUTH_TOKEN: '',
      ...Object.fromEntries(CLAUDE_MODEL_VARIABLES.map((name) => [name, model])),
    };
  }
}
