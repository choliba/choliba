import { providerModel } from '../../../agents/runs/provider-model';
import { claudeOllamaProvider, claudeProvider, cursorProvider, PROVIDERS_WITH_OLLAMA } from '../../helpers/providers';

const DECLARED = ['claude-sonnet-5', 'ollama:qwen3.5:4b', 'ollama:qwen2.5-coder:7b'];

describe('providerModel', () => {
  it('passes an explicit model the provider runs', () => {
    expect(providerModel(claudeProvider, 'claude-sonnet-5', DECLARED, PROVIDERS_WITH_OLLAMA)).toEqual({
      model: 'claude-sonnet-5',
    });
    expect(providerModel(claudeOllamaProvider, 'ollama:qwen2.5-coder:7b', DECLARED, PROVIDERS_WITH_OLLAMA)).toEqual({
      model: 'ollama:qwen2.5-coder:7b',
    });
  });

  it("refuses another provider's model, naming the provider that runs it", () => {
    expect(providerModel(claudeProvider, 'ollama:qwen3.5:4b', DECLARED, PROVIDERS_WITH_OLLAMA)).toEqual({
      error: 'O modelo "ollama:qwen3.5:4b" é do provider claude-ollama: rode com --provider claude-ollama.',
    });
    expect(providerModel(cursorProvider, 'ollama:qwen3.5:4b', DECLARED, PROVIDERS_WITH_OLLAMA)).toHaveProperty('error');
    expect(providerModel(claudeOllamaProvider, 'claude-sonnet-5', DECLARED, PROVIDERS_WITH_OLLAMA)).toEqual({
      error: 'O provider claude-ollama só roda modelos ollama:<modelo>; "claude-sonnet-5" não é um deles.',
    });
  });

  it('without --model, asks a plain provider for none, and one of its own prefix for the first it declares', () => {
    expect(providerModel(claudeProvider, undefined, DECLARED, PROVIDERS_WITH_OLLAMA)).toEqual({ model: undefined });
    expect(providerModel(claudeOllamaProvider, undefined, DECLARED, PROVIDERS_WITH_OLLAMA)).toEqual({
      model: 'ollama:qwen3.5:4b',
    });
  });

  it('refuses a provider of its own prefix when the agent declares none of its models', () => {
    expect(providerModel(claudeOllamaProvider, undefined, ['claude-sonnet-5'], PROVIDERS_WITH_OLLAMA)).toEqual({
      error:
        'O provider claude-ollama roda um modelo declarado como ollama:<modelo> em agent.yaml#models, e o agente não declara nenhum.',
    });
  });
});
