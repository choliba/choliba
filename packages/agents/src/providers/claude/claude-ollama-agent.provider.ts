import { CHOL_OLLAMA_URL } from '@choliba/core';

import type { ProviderRequest, ProviderVariablesInput } from '../../common';
import { ClaudeAgentProvider } from './claude-agent.provider';

/** Where Ollama listens when `CHOL_OLLAMA_URL` says nothing. */
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

/** How an `agent.yaml#models` id names a model of Ollama: `ollama:qwen3.5:4b`. */
const OLLAMA_PREFIX = 'ollama:';

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
 * parser as `claude`, with the API at `CHOL_OLLAMA_URL` and the model one the agent declares as `ollama:<model>`. The
 * credential is Ollama's placeholder token, and Claude's own credentials are emptied so none of them reaches Ollama.
 */
export class ClaudeOllamaAgentProvider extends ClaudeAgentProvider {
  override readonly id = 'claude-ollama';
  /** Never picked by `auto`: it needs an `ollama:` model, which most agents do not declare. */
  override readonly autoPriority = 3;
  override readonly inAuto = false;
  override readonly modelPrefix = OLLAMA_PREFIX;
  override readonly summary =
    'Comando `claude`, com um modelo do Ollama (`ollama:<modelo>` em agent.yaml#models) servido em CHOL_OLLAMA_URL.';

  /** The model Ollama takes for a declared one (`ollama:qwen3.5:4b` → `qwen3.5:4b`). */
  apiModel(declared: string): string {
    return declared.startsWith(OLLAMA_PREFIX) ? declared.slice(OLLAMA_PREFIX.length) : declared;
  }

  override declaredModel(reported: string): string {
    return `${OLLAMA_PREFIX}${reported}`;
  }

  override quietStderr(line: string): boolean {
    return line.startsWith(UNRECOGNIZED_MODEL);
  }

  override buildArgs(request: ProviderRequest): readonly string[] {
    if (request.model === undefined) return super.buildArgs(request);
    return super.buildArgs({ ...request, model: this.apiModel(request.model) });
  }

  override variables(input: ProviderVariablesInput): Readonly<Record<string, string>> {
    const { request, config, reachable } = input;
    const model = this.apiModel(request.model ?? '');
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
