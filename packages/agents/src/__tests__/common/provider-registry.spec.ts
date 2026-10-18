import { coreShell, createShell } from '@choliba/core';
import { fakePlatform, VERBS_ROOT } from '@choliba/core/testing';

import { AGENT_PROVIDERS, agentsShell, knownProviders } from '../..';
import {
  AUTO,
  InvalidProviderPreferenceError,
  ProviderNotFoundError,
  ProviderRegistry,
} from '../../common/provider-registry';
import {
  claudeOllamaProvider,
  claudeProvider,
  cursorProvider,
  PROVIDERS,
  PROVIDERS_WITH_OLLAMA,
} from '../helpers/providers';

function whichOf(available: readonly string[]): (bin: string) => string | null {
  return (bin) => (available.includes(bin) ? `/usr/bin/${bin}` : null);
}

describe('ProviderRegistry.parsePreference', () => {
  it('defaults undefined to auto', () => {
    expect(PROVIDERS.parsePreference(undefined)).toBe(AUTO);
  });

  it('passes through auto and the id of every provider', () => {
    expect(PROVIDERS.parsePreference('auto')).toBe('auto');
    expect(PROVIDERS.parsePreference('claude')).toBe('claude');
    expect(PROVIDERS.parsePreference('cursor')).toBe('cursor');
  });

  it('rejects anything else, naming what it takes', () => {
    expect(() => PROVIDERS.parsePreference('codex')).toThrow(InvalidProviderPreferenceError);
    expect(() => PROVIDERS.parsePreference('codex')).toThrow(
      'unknown provider "codex" (expected auto, claude or cursor)',
    );
    expect(() => new ProviderRegistry([]).parsePreference('codex')).toThrow('(expected auto)');
  });
});

describe('ProviderRegistry.resolve', () => {
  it('prefers cursor over claude in auto mode when both are available (autoPriority)', () => {
    expect(PROVIDERS.resolve('auto', whichOf(['claude', 'cursor-agent', 'agent'])).adapter).toBe(cursorProvider);
  });

  it('falls back to claude in auto mode when no cursor binary is found', () => {
    expect(PROVIDERS.resolve('auto', whichOf(['claude'])).adapter).toBe(claudeProvider);
  });

  it('tries the cursor candidates in order: agent, then cursor-agent, then cursor', () => {
    expect(PROVIDERS.resolve('cursor', whichOf(['agent'])).command).toEqual(['agent']);
    expect(PROVIDERS.resolve('cursor', whichOf(['cursor-agent'])).command).toEqual(['cursor-agent']);
    expect(PROVIDERS.resolve('cursor', whichOf(['cursor'])).command).toEqual(['cursor', 'agent']);
  });

  it('keeps the executable path returned by the PATH lookup', () => {
    expect(PROVIDERS.resolve('claude', whichOf(['claude'])).executable).toBe('/usr/bin/claude');
  });

  it('honors an explicit preference even when the other provider is also available', () => {
    expect(PROVIDERS.resolve('claude', whichOf(['claude', 'agent'])).adapter).toBe(claudeProvider);
  });

  it('throws ProviderNotFoundError, naming what was tried, when nothing resolves', () => {
    expect(() => PROVIDERS.resolve('auto', whichOf([]))).toThrow(ProviderNotFoundError);
    expect(() => PROVIDERS.resolve('auto', whichOf([]))).toThrow('(tried: cursor, claude)');
    expect(() => PROVIDERS.resolve('claude', whichOf([]))).toThrow(/claude/);
  });
});

describe('ProviderRegistry — the names and descriptions --provider shows', () => {
  it('lists auto first, then the providers by id, whatever order they were found in', () => {
    expect(new ProviderRegistry([cursorProvider, claudeProvider]).choices()).toEqual(['auto', 'claude', 'cursor']);
  });

  it('lists the providers themselves by id, and knows the three choliba ships', () => {
    expect(new ProviderRegistry([cursorProvider, claudeProvider]).list()).toEqual([claudeProvider, cursorProvider]);
    expect(knownProviders().choices()).toEqual(['auto', 'claude', 'claude-ollama', 'cursor']);
  });

  it("says auto's order and how each provider is found", () => {
    expect(PROVIDERS.descriptions()).toEqual([
      { name: 'auto', description: 'O primeiro instalado, nesta ordem: cursor, claude.' },
      { name: 'claude', description: 'Comando `claude`.' },
      {
        name: 'cursor',
        description: 'Comando `agent`, `cursor-agent` ou `cursor agent`, o primeiro que estiver instalado.',
      },
    ]);
  });
});

describe('AGENT_PROVIDERS', () => {
  it('gives claude, claude-ollama and cursor, in that order, once', () => {
    const { container } = createShell(fakePlatform(), [coreShell, agentsShell, VERBS_ROOT]);

    expect(container.get(AGENT_PROVIDERS).choices()).toEqual(['auto', 'claude', 'claude-ollama', 'cursor']);
    expect(container.get(AGENT_PROVIDERS)).toBe(container.get(AGENT_PROVIDERS));
  });
});

describe('ProviderRegistry with a provider of its own models', () => {
  it('never picks it in auto, but runs it when named', () => {
    expect(PROVIDERS_WITH_OLLAMA.resolve('auto', whichOf(['claude'])).adapter).toBe(claudeProvider);
    expect(PROVIDERS_WITH_OLLAMA.resolve('claude-ollama', whichOf(['claude'])).adapter).toBe(claudeOllamaProvider);
    expect(PROVIDERS_WITH_OLLAMA.parsePreference('claude-ollama')).toBe('claude-ollama');
  });

  it('says what it is in --help, and owns the models of its prefix', () => {
    expect(PROVIDERS_WITH_OLLAMA.descriptions().find(({ name }) => name === 'claude-ollama')?.description).toBe(
      claudeOllamaProvider.summary,
    );
    expect(PROVIDERS_WITH_OLLAMA.modelOwner('ollama:qwen3.5:4b')).toBe(claudeOllamaProvider);
    expect(PROVIDERS_WITH_OLLAMA.modelOwner('claude-sonnet-5')).toBeUndefined();
  });
});
