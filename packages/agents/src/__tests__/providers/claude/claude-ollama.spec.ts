import type { ProviderRequest } from '../../../common/interfaces/provider.interface';
import { NO_PERMISSIONS } from '../../../common/agent-permissions';
import { DEFAULT_OLLAMA_URL } from '../../../providers/claude/claude-ollama-agent.provider';
import { claudeOllamaProvider } from '../../helpers/providers';
import { NO_MODE_STEPS, fakeSections } from '../../helpers/agent';

function request(model: string | undefined): ProviderRequest {
  return {
    agent: {
      name: 'echo',
      id: 'echo',
      displayName: 'Echo',
      version: '1.0.0',
      description: 'd',
      supportedModels: ['ollama:qwen3.5:4b'],
      skills: [],
      mcps: [],
      policy: 'read-only',
      taskRequired: true,
      projectRequired: false,
      allowWithoutTicket: false,
      defaultMode: 'execute',
      modes: ['execute'],
      permissions: NO_PERMISSIONS,
      steps: NO_MODE_STEPS,
      sections: fakeSections('be an echo'),
      dir: '/repo/agents/echo',
      sourcePath: '/repo/agents/echo/agent.yaml',
    },
    mode: 'execute',
    policy: 'read-only',
    userPrompt: 'do the task',
    workspaceRoot: '/repo',
    runDir: '/repo/.cache/runs/x',
    addDirs: [],
    model,
  };
}

describe('ClaudeOllamaAgentProvider', () => {
  it('runs only when named, and only the models of its prefix', () => {
    expect(claudeOllamaProvider.id).toBe('claude-ollama');
    expect(claudeOllamaProvider.inAuto).toBe(false);
    expect(claudeOllamaProvider.modelPrefix).toBe('ollama:');
    expect(claudeOllamaProvider.binaries).toEqual([['claude']]);
    expect(claudeOllamaProvider.summary).toContain('CHOL_OLLAMA_URL');
  });

  it("asks Claude Code for the model by Ollama's name, and reads the reported one back as declared", () => {
    const args = claudeOllamaProvider.buildArgs(request('ollama:qwen3.5:4b'));
    expect(args.at(args.indexOf('--model') + 1)).toBe('qwen3.5:4b');
    expect(claudeOllamaProvider.buildArgs(request(undefined))).not.toContain('--model');
    expect(claudeOllamaProvider.apiModel('qwen3.5:4b')).toBe('qwen3.5:4b');
    expect(claudeOllamaProvider.declaredModel('qwen3.5:4b')).toBe('ollama:qwen3.5:4b');
  });

  it("points Claude Code at Ollama, with Ollama's token and none of Claude's, every model set to the run's", () => {
    const variables = claudeOllamaProvider.variables({
      request: request('ollama:qwen3.5:4b'),
      config: {},
      reachable: (url) => url,
    });
    expect(variables).toEqual({
      ANTHROPIC_BASE_URL: DEFAULT_OLLAMA_URL,
      ANTHROPIC_AUTH_TOKEN: 'ollama',
      ANTHROPIC_API_KEY: '',
      CLAUDE_CODE_OAUTH_TOKEN: '',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'qwen3.5:4b',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'qwen3.5:4b',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'qwen3.5:4b',
      ANTHROPIC_SMALL_FAST_MODEL: 'qwen3.5:4b',
    });
  });

  it('takes the address from CHOL_OLLAMA_URL, as the provider reaches it', () => {
    const variables = claudeOllamaProvider.variables({
      request: request('ollama:qwen3.5:4b'),
      config: { CHOL_OLLAMA_URL: 'http://localhost:9999' },
      reachable: (url) => url.replace('localhost', 'host.docker.internal'),
    });
    expect(variables['ANTHROPIC_BASE_URL']).toBe('http://host.docker.internal:9999');
  });
});
