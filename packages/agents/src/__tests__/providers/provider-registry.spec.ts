import { Test } from '@nestjs/testing';

import { ClaudeProviderModule, CursorProviderModule, ProviderRegistryService, ProvidersModule } from '../../nest';
import {
  AUTO,
  InvalidProviderPreferenceError,
  ProviderNotFoundError,
  ProviderRegistry,
} from '../../providers/provider-registry';
import { claudeProvider, cursorProvider, PROVIDERS } from '../helpers/providers';

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

describe('ProviderRegistryService', () => {
  it('finds every provider registered by the imported provider modules, once', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProvidersModule, ClaudeProviderModule, CursorProviderModule],
    }).compile();
    await moduleRef.init();
    const service = moduleRef.get(ProviderRegistryService);

    expect(service.registry().choices()).toEqual(['auto', 'claude', 'cursor']);
    expect(service.registry()).toBe(service.registry());
  });

  it('finds none without a provider module', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProvidersModule] }).compile();
    await moduleRef.init();

    expect(moduleRef.get(ProviderRegistryService).registry().choices()).toEqual(['auto']);
  });
});
