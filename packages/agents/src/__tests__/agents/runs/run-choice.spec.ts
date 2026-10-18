import type { AgentDefinition } from '../../../common';
import { agentRunChoice, declaredModels } from '../../../agents/runs/run-choice';
import { PROVIDERS_WITH_OLLAMA } from '../../helpers/providers';

/** An agent that declares `providers`, the rest of it never read here. */
function agent(providers: AgentDefinition['providers']): AgentDefinition {
  return { id: 'local', providers } as AgentDefinition;
}

/** A machine where only `installed` are on the PATH. */
function whichOf(installed: readonly string[]): (bin: string) => string | null {
  return (bin) => (installed.includes(bin) ? `/usr/bin/${bin}` : null);
}

const MIXED = agent([
  { id: 'claude', models: ['claude-sonnet-5'] },
  { id: 'claude-ollama', models: ['qwen3.5:4b', 'llama3.2'] },
]);

/** The provider and model `agentRunChoice` picks, or its error. */
function pick(declared: AgentDefinition, ask: Parameters<typeof agentRunChoice>[1], installed = ['claude']) {
  const choice = agentRunChoice(declared, ask, PROVIDERS_WITH_OLLAMA, whichOf(installed));
  return 'error' in choice ? choice : { provider: choice.resolved.adapter.id, model: choice.model };
}

describe('agentRunChoice', () => {
  it('runs the first declared provider that is installed under auto, its default model or its first declared one', () => {
    expect(pick(MIXED, { preference: 'auto' })).toEqual({ provider: 'claude', model: undefined });
    expect(pick(MIXED, {})).toEqual({ provider: 'claude', model: undefined });
    expect(pick(agent([{ id: 'claude-ollama', models: ['qwen3.5:4b'] }]), {})).toEqual({
      provider: 'claude-ollama',
      model: 'qwen3.5:4b',
    });
  });

  it('takes --provider or the preference only when the agent declares it, and when it is installed', () => {
    expect(pick(MIXED, { provider: 'claude-ollama' })).toEqual({ provider: 'claude-ollama', model: 'qwen3.5:4b' });
    expect(pick(MIXED, { preference: 'cursor' })).toEqual({
      error: 'O agente local não declara o provider cursor (declara: claude, claude-ollama).',
    });
    expect(pick(agent([{ id: 'cursor', models: ['Auto'] }]), { provider: 'cursor' })).toEqual({
      error: 'O provider cursor não está instalado nesta máquina.',
    });
    expect(pick(MIXED, { provider: 'gpt' })).toEqual({
      error: 'unknown provider "gpt" (expected auto, claude, claude-ollama or cursor)',
    });
  });

  it('runs --model on the provider that declares it, the only one, and only a model that provider declares', () => {
    expect(pick(MIXED, { model: 'llama3.2' })).toEqual({ provider: 'claude-ollama', model: 'llama3.2' });
    expect(pick(MIXED, { model: 'gpt-5' })).toEqual({
      error:
        'O modelo gpt-5 não está declarado no agente local (claude: claude-sonnet-5 · claude-ollama: qwen3.5:4b, llama3.2).',
    });
    expect(pick(MIXED, { provider: 'claude', model: 'llama3.2' })).toEqual({
      error: 'O modelo llama3.2 não está entre os de claude no agente local (claude-sonnet-5).',
    });
    const both = agent([
      { id: 'claude', models: ['m'] },
      { id: 'cursor', models: ['m'] },
    ]);
    expect(pick(both, { model: 'm' })).toEqual({
      error: 'O modelo m está declarado em claude e cursor: diga qual com --provider.',
    });
  });

  it('says when no provider the agent declares is installed', () => {
    expect(pick(MIXED, {}, [])).toEqual({
      error: 'Nenhum provider que o agente local declara está instalado: claude, claude-ollama.',
    });
  });
});

describe('declaredModels', () => {
  it('gives the models the agent declares for a provider, and none for one it does not declare', () => {
    expect(declaredModels(MIXED, 'claude-ollama')).toEqual(['qwen3.5:4b', 'llama3.2']);
    expect(declaredModels(MIXED, 'cursor')).toEqual([]);
  });
});
