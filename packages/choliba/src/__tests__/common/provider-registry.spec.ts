import { baseShell, createShell } from '@choliba/shell';
import { fakePlatform } from '@choliba/kernel/testing';
import { VERBS_ROOT } from '@choliba/shell/testing';

import { AGENT_PROVIDERS, agentsShell } from '../../agents';
import { knownProviders } from '@choliba/providers';
import { knownProvidersShell } from '../helpers/providers-shell';
import { AUTO, InvalidProviderPreferenceError, ProviderNotFoundError, ProviderRegistry } from '@choliba/engine';
import {
  claudeOllamaProvider,
  claudeProvider,
  codexProvider,
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
    expect(PROVIDERS.parsePreference('codex')).toBe('codex');
    expect(PROVIDERS.parsePreference('cursor')).toBe('cursor');
  });

  it('rejects anything else, naming what it takes', () => {
    expect(() => PROVIDERS.parsePreference('gpt')).toThrow(InvalidProviderPreferenceError);
    expect(() => PROVIDERS.parsePreference('gpt')).toThrow(
      'unknown provider "gpt" (expected auto, claude, codex or cursor)',
    );
    expect(() => new ProviderRegistry([]).parsePreference('codex')).toThrow('(expected auto)');
  });
});

describe('ProviderRegistry.resolve', () => {
  it('prefers cursor over claude in auto mode when both are available (autoPriority)', () => {
    expect(PROVIDERS.resolve('auto', whichOf(['claude', 'cursor-agent', 'agent'])).adapter).toBe(cursorProvider);
  });

  it('falls back from cursor to codex, then claude, in auto mode', () => {
    expect(PROVIDERS.resolve('auto', whichOf(['codex', 'claude'])).adapter).toBe(codexProvider);
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
    expect(() => PROVIDERS.resolve('auto', whichOf([]))).toThrow('(tried: cursor, codex, claude)');
    expect(() => PROVIDERS.resolve('claude', whichOf([]))).toThrow(/claude/);
  });
});

describe('ProviderRegistry — the names and descriptions --provider shows', () => {
  it('lists auto first, then the providers by id, whatever order they were found in', () => {
    expect(new ProviderRegistry([cursorProvider, codexProvider, claudeProvider]).choices()).toEqual([
      'auto',
      'claude',
      'codex',
      'cursor',
    ]);
  });

  it('lists the providers themselves by id, and knows the three choliba ships', () => {
    expect(new ProviderRegistry([cursorProvider, codexProvider, claudeProvider]).list()).toEqual([
      claudeProvider,
      codexProvider,
      cursorProvider,
    ]);
    expect(knownProviders().choices()).toEqual(['auto', 'claude', 'claude-ollama', 'codex', 'cursor']);
  });

  it("says auto's order and how each provider is found", () => {
    expect(PROVIDERS.descriptions()).toEqual([
      {
        name: 'auto',
        description: 'O primeiro provider que o agente declara e que está instalado, na ordem do agent.yaml.',
      },
      { name: 'claude', description: 'Comando `claude`.' },
      { name: 'codex', description: 'Comando `codex`.' },
      {
        name: 'cursor',
        description: 'Comando `agent`, `cursor-agent` ou `cursor agent`, o primeiro que estiver instalado.',
      },
    ]);
  });
});

describe('AGENT_PROVIDERS', () => {
  it('gives claude, claude-ollama, codex and cursor, in that order, once', () => {
    const { container } = createShell(fakePlatform(), [baseShell, knownProvidersShell, agentsShell, VERBS_ROOT]);

    expect(container.get(AGENT_PROVIDERS).choices()).toEqual(['auto', 'claude', 'claude-ollama', 'codex', 'cursor']);
    expect(container.get(AGENT_PROVIDERS)).toBe(container.get(AGENT_PROVIDERS));
  });
});

describe('ProviderRegistry with a provider of its own models', () => {
  it('never picks it in auto, but runs it when named', () => {
    expect(PROVIDERS_WITH_OLLAMA.resolve('auto', whichOf(['claude'])).adapter).toBe(claudeProvider);
    expect(PROVIDERS_WITH_OLLAMA.resolve('claude-ollama', whichOf(['claude'])).adapter).toBe(claudeOllamaProvider);
    expect(PROVIDERS_WITH_OLLAMA.parsePreference('claude-ollama')).toBe('claude-ollama');
  });

  it('says what it is in --help', () => {
    expect(PROVIDERS_WITH_OLLAMA.descriptions().find(({ name }) => name === 'claude-ollama')?.description).toBe(
      claudeOllamaProvider.summary,
    );
  });
});
