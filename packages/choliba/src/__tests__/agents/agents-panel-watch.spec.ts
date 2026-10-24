import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Container } from '@choliba/kernel';
import { parseColors, PLATFORM, THEME, ThemeService, WORKSPACE_ROOT } from '@choliba/shell';
import { fakeChatPanel, fakePanelContext } from '@choliba/tui/testing';
import { fakePlatform } from '@choliba/kernel/testing';
import { sandboxConfig } from '@choliba/sandbox';
import { agentsPanel, watchChoices } from '../../panel';

import { ProviderRegistry } from '@choliba/engine';
import { agentsConfig } from '../../agents/agents/agents-config';
import { talkToAgent } from '../../agents/agents/agents-panel-run';
import { AGENT_PROVIDERS, AGENTS } from '../../agents/agents/agents.constants';
import type { AgentsService } from '../../agents/agents/agents.service';
import { ClaudeAgentProvider } from '@choliba/providers';
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
  watchChoices(container, state.context);
  return { container, state };
}

describe('watchChoices, from the start of a panel session', () => {
  it('does nothing when the app has not registered agents', () => {
    const state = fakePanelContext();

    watchChoices(new Container(), state.context);

    expect(state.statuses.size).toBe(0);
  });

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

  it("moves an agent whose card is dragged onto another's to its place, not while the agents run", async () => {
    const tmp = makeTmpDir('watch-move');
    try {
      cpSync(join(FIXTURES, 'echo'), join(tmp.path, 'echo'), { recursive: true });
      mkdirSync(join(tmp.path, 'other'));
      const echo = readFileSync(join(FIXTURES, 'echo', 'agent.yaml'), 'utf8');
      writeFileSync(join(tmp.path, 'other', 'agent.yaml'), echo.replace('id: echo', 'id: other'));
      const { container, state } = session(tmp.path);
      const fake = fakeChatPanel();
      state.context.set('agente', 'echo,other');
      state.context.set('retomar', '1');

      state.move('other', 'echo', fake.panel);
      expect(state.values.get('agente')).toBe('other,echo');
      expect(state.values.get('retomar')).toBeUndefined();
      expect(fake.written).toHaveLength(1);
      expect(fake.written[0]).toMatch(/^Agente .*other.* movido\. Ordem: .*other.* → .*echo.*\.$/);
      expect(state.cards.get('other')?.joined).toBe(false);
      expect(state.cards.get('echo')?.joined).toBe(true);

      // An agent no longer in the session, or one that no longer loads, keeps the order or its plain name.
      state.move('gone', 'echo', fake.panel);
      expect(state.values.get('agente')).toBe('other,echo');
      state.context.set('agente', 'other,gone');
      state.move('gone', 'other', fake.panel);
      expect(fake.written.at(-1)).toMatch(/^Agente gone movido\. Ordem: gone → .*other.*\.$/);

      // While the agents run, the order stays.
      container.provide(
        AGENTS,
        () => ({ runHosted: () => new Promise<number>(() => undefined) }) as unknown as AgentsService,
      );
      state.context.set('agente', 'echo,other');
      talkToAgent(container, state.context);
      state.send('faça', fake.panel);
      await new Promise((resolve) => setImmediate(resolve));
      state.move('other', 'echo', fake.panel);
      expect(state.values.get('agente')).toBe('echo,other');
      expect(fake.written.at(-1)).toBe(warn('A ordem dos agentes não muda enquanto eles rodam.'));
      // /resume waits for them to end.
      const resume = agentsPanel.find((command) => command.name === 'resume');
      expect(resume?.unavailable?.(state.context, container)).toBe(
        'Os agentes estão rodando: espere terminar ou pare com Ctrl+C',
      );
      // /agents changes the one waiting, not the one running.
      const agents = agentsPanel.find((command) => command.name === 'agents');
      expect(agents?.unavailable?.(state.context, container)).toBeUndefined();
      await agents?.run({ container, panel: fake.panel, context: state.context });
      expect(fake.written.at(-1)).toBe(
        warn('O agente echo está rodando: troque o provider e o modelo dele depois que terminar.'),
      );
      fake.answerNext(1, undefined, undefined);
      await agents?.run({ container, panel: fake.panel, context: state.context });
      expect(fake.written.at(-1)).toContain('atualizado.');
      expect(state.values.get('agente')).toBe('echo,other');
    } finally {
      tmp.cleanup();
    }
  });
});
