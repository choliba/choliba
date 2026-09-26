import { claudeProvider } from '../../providers/claude';
import { cursorProvider } from '../../providers/cursor';
import {
  InvalidProviderPreferenceError,
  ProviderNotFoundError,
  parseProviderPreference,
  resolveProvider,
} from '../../providers/registry';

function whichOf(available: readonly string[]): (bin: string) => string | null {
  return (bin) => (available.includes(bin) ? `/usr/bin/${bin}` : null);
}

describe('parseProviderPreference', () => {
  it('defaults undefined to auto', () => {
    expect(parseProviderPreference(undefined)).toBe('auto');
  });

  it('passes through auto, claude and cursor', () => {
    expect(parseProviderPreference('auto')).toBe('auto');
    expect(parseProviderPreference('claude')).toBe('claude');
    expect(parseProviderPreference('cursor')).toBe('cursor');
  });

  it('rejects anything else', () => {
    expect(() => parseProviderPreference('codex')).toThrow(InvalidProviderPreferenceError);
  });
});

describe('resolveProvider', () => {
  it('prefers cursor over claude in auto mode when both are available', () => {
    const resolved = resolveProvider('auto', whichOf(['claude', 'cursor-agent', 'agent']));

    expect(resolved.adapter).toBe(cursorProvider);
  });

  it('falls back to claude in auto mode when no cursor binary is found', () => {
    const resolved = resolveProvider('auto', whichOf(['claude']));

    expect(resolved.adapter).toBe(claudeProvider);
  });

  it('tries the cursor candidates in order: agent, then cursor-agent, then cursor', () => {
    expect(resolveProvider('cursor', whichOf(['agent'])).command).toEqual(['agent']);
    expect(resolveProvider('cursor', whichOf(['cursor-agent'])).command).toEqual(['cursor-agent']);
    expect(resolveProvider('cursor', whichOf(['cursor'])).command).toEqual(['cursor', 'agent']);
  });

  it('honors an explicit preference even when the other provider is also available', () => {
    const resolved = resolveProvider('claude', whichOf(['claude', 'agent']));

    expect(resolved.adapter).toBe(claudeProvider);
  });

  it('throws ProviderNotFoundError, naming what was tried, when nothing resolves', () => {
    expect(() => resolveProvider('auto', whichOf([]))).toThrow(ProviderNotFoundError);
    expect(() => resolveProvider('claude', whichOf([]))).toThrow(/claude/);
  });
});
