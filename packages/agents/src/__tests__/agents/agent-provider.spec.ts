import { agentProvider } from '../../agents/agent-provider';

/** A registry whose `ollama:` models are claude-ollama's and `local:` ones are other's; any other model is no one's. */
const REGISTRY = {
  modelOwner: (model: string) =>
    model.startsWith('ollama:')
      ? ({ id: 'claude-ollama' } as never)
      : model.startsWith('local:')
        ? ({ id: 'other' } as never)
        : undefined,
};

describe('agentProvider', () => {
  it('asks for the provider every declared model belongs to', () => {
    expect(agentProvider({ supportedModels: ['ollama:a', 'ollama:b'] }, REGISTRY)).toBe('claude-ollama');
  });

  it('asks for none with a model of no prefix, models of different providers, or no model', () => {
    expect(agentProvider({ supportedModels: ['ollama:a', 'claude-3-5-sonnet'] }, REGISTRY)).toBeUndefined();
    expect(agentProvider({ supportedModels: ['ollama:a', 'local:b'] }, REGISTRY)).toBeUndefined();
    expect(agentProvider({ supportedModels: ['claude-3-5-sonnet'] }, REGISTRY)).toBeUndefined();
    expect(agentProvider({ supportedModels: [] }, REGISTRY)).toBeUndefined();
  });
});
