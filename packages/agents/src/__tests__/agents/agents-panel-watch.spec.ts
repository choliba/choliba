import { cpSync } from 'node:fs';
import { join } from 'node:path';

import { Container, parseColors, PLATFORM, THEME, ThemeService, WORKSPACE_ROOT } from '@choliba/core';
import { fakePanelContext, fakePlatform } from '@choliba/core/testing';
import { sandboxConfig } from '@choliba/sandbox';

import { ProviderRegistry } from '../../common';
import { agentsConfig } from '../../agents/agents-config';
import { watchChoices } from '../../agents/agents-panel-watch';
import { agentsShell } from '../../agents/agents-shell';
import { AGENT_PROVIDERS } from '../../agents/agents.constants';
import { ClaudeAgentProvider } from '../../providers';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

/** A session whose sandbox is `sandbox` (`erro`: the configuration does not read), on a machine with `docker` or not. */
function session(dir: string, sandbox = 'local', docker = true) {
  const container = new Container();
  container.provide(agentsConfig.token, () => ({ ...agentsConfig.read([]), agentsDir: dir, provider: 'claude' }));
  container.provide(sandboxConfig.token, () => {
    if (sandbox === 'erro') throw new Error('CHOL_SANDBOX: use local ou docker');
    return { ...sandboxConfig.read([]), mode: sandbox };
  });
  container.provide(WORKSPACE_ROOT, () => '/');
  const platform = fakePlatform({ which: (bin) => (bin === 'docker' && !docker ? null : `/usr/bin/${bin}`) });
  container.provide(PLATFORM, () => platform);
  container.provide(THEME, () => new ThemeService({}, platform.stdout, false, parseColors('')));
  container.provide(AGENT_PROVIDERS, () => new ProviderRegistry([new ClaudeAgentProvider()]));
  const state = fakePanelContext();
  agentsShell.panelStart?.(container, state.context);
  return { container, state };
}

describe('watchChoices, from the start of a panel session', () => {
  it('shows the sandbox selected in the status line, and again when /sandbox chooses another', () => {
    const tmp = makeTmpDir('watch-sandbox');
    try {
      const { container, state } = session(tmp.path);

      expect(state.statuses.get('sandbox')).toBe(`${gray('sandbox')} ${bold('local')}`);
      state.context.set('sandbox', 'docker');
      expect(state.statuses.get('sandbox')).toBe(`${gray('sandbox')} ${bold('docker')}`);
      // Once per session: watching again adds no listener.
      watchChoices(container, state.context);
      state.context.clear();
      expect(state.statuses.get('sandbox')).toBe(`${gray('sandbox')} ${bold('local')}`);
    } finally {
      tmp.cleanup();
    }
  });

  it('says in yellow a sandbox no run could use: Docker missing, or a CHOL_SANDBOX that does not read', () => {
    const tmp = makeTmpDir('watch-sandbox-warn');
    try {
      expect(session(tmp.path, 'docker', false).state.statuses.get('sandbox')).toBe(
        `${gray('sandbox')} ${warn('docker')}`,
      );
      expect(session(tmp.path, 'erro').state.statuses.get('sandbox')).toBe(
        `${gray('sandbox')} ${warn('indisponível')}`,
      );
      expect(session(tmp.path, 'nuvem').state.statuses.get('sandbox')).toBe(
        `${gray('sandbox')} ${warn('indisponível')}`,
      );
    } finally {
      tmp.cleanup();
    }
  });

  it("puts the sandbox after the mode, and the ticket chosen with /tickets in the agent's card", () => {
    const tmp = makeTmpDir('watch-ticket');
    try {
      cpSync(join(FIXTURES, 'echo'), join(tmp.path, 'echo'), { recursive: true });
      const { state } = session(tmp.path);
      state.context.set('agente', 'echo');
      state.context.set('ticket', 'app-1');

      expect([...state.statuses.keys()]).toEqual(['modo', 'sandbox']);
      expect(state.cards.get('echo')?.summary?.at(-1)).toBe('ticket \u001b[1mapp-1\u001b[22m');
      state.context.set('ticket', undefined);
      expect(state.cards.get('echo')?.summary?.at(-1)).toBe(gray('sem ticket'));
      // An agent of the sequence that no longer loads has no card.
      state.context.set('agente', 'echo,gone');
      state.context.set('ticket', undefined);
      expect([...state.cards.keys()]).toEqual(['echo']);
    } finally {
      tmp.cleanup();
    }
  });
});
