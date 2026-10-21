import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  boldAnsi,
  Container,
  paintAnsi,
  parseColors,
  PLATFORM,
  THEME,
  ThemeService,
  WORKSPACE_ROOT,
  type PanelCommand,
} from '@choliba/core';
import { fakeChatPanel, fakePanelContext, fakePlatform } from '@choliba/core/testing';

import { ProviderRegistry } from '../../common';
import { sandboxConfig } from '@choliba/sandbox';

import { agentsConfig } from '../../agents/agents-config';
import { agentsPanel } from '../../agents/agents-panel';
import { loadAgent } from '../../agents/agent-loader';
import { sessionArgv, showRun } from '../../agents/agents-panel-state';
import { agentsShell } from '../../agents/agents-shell';
import { AGENT_PROVIDERS } from '../../agents/agents.constants';
import { ClaudeAgentProvider, ClaudeOllamaAgentProvider, CursorAgentProvider } from '../../providers';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

/** `echo` (claude and cursor) and `local` (claude and claude-ollama), both taking every mode. */
function agentsFolder(dir: string): void {
  cpSync(join(FIXTURES, 'echo'), join(dir, 'echo'), { recursive: true });
  const echo = readFileSync(join(FIXTURES, 'echo', 'agent.yaml'), 'utf8');
  mkdirSync(join(dir, 'local'));
  writeFileSync(
    join(dir, 'local', 'agent.yaml'),
    echo
      .replace('id: echo', 'id: local')
      .replace('  cursor:\n    models:\n      - gpt-4o\n', "  claude-ollama:\n    models:\n      - 'qwen3.5:4b'\n"),
  );
}

/** The panel's commands on a machine whose binaries are `installed`, with `provider` as `CHOL_AGENTS_PROVIDER`. */
function session(dir: string, installed: (bin: string) => boolean, provider = 'auto', sandbox = 'local') {
  const container = new Container();
  container.provide(agentsConfig.token, () => ({ ...agentsConfig.read([]), agentsDir: dir, provider }));
  container.provide(sandboxConfig.token, () => {
    if (sandbox === 'erro') throw new Error('CHOL_SANDBOX: use local ou docker');
    return { ...sandboxConfig.read([]), mode: sandbox };
  });
  container.provide(WORKSPACE_ROOT, () => '/');
  const platform = fakePlatform({ which: (bin: string) => (installed(bin) ? `/usr/bin/${bin}` : null) });
  container.provide(PLATFORM, () => platform);
  container.provide(THEME, () => new ThemeService({}, platform.stdout, false, parseColors('')));
  container.provide(
    AGENT_PROVIDERS,
    () => new ProviderRegistry([new ClaudeAgentProvider(), new ClaudeOllamaAgentProvider(), new CursorAgentProvider()]),
  );
  const fake = fakeChatPanel();
  const state = fakePanelContext();
  const command = (name: string): PanelCommand => {
    const found = agentsPanel.find((each) => each.name === name);
    if (found === undefined) throw new Error(name);
    return found;
  };
  const run = (name: string, answer: number | undefined): Promise<void> => {
    fake.answer(answer);
    return command(name).run({ container, panel: fake.panel, context: state.context });
  };
  // /agents asks for the agent, its provider, its model (Esc takes the panel's), then for the next one: "nenhum outro"
  // (0) keeps it alone.
  const add = (...answers: (number | undefined)[]): Promise<void> => {
    fake.answer(0);
    fake.answerNext(...answers);
    return command('agents').run({ container, panel: fake.panel, context: state.context });
  };
  const why = (name: string): string | undefined => command(name).unavailable?.(state.context, container);
  return { fake, state, run, add, why, container };
}

/** The provider and the model, as an agent's card paints them: bold, in the agent's color. */
const painted = (color: 'red' | 'green', text: string): string => boldAnsi(paintAnsi(color, text));
const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

/** Every binary but the cursor provider's (`agent`, `cursor-agent`, `cursor agent`). */
const noCursor = (bin: string): boolean => !['agent', 'cursor-agent', 'cursor'].includes(bin);

describe('/agents, the provider and the model of each agent', () => {
  it('asks each agent its provider among those it declares, then its model, and keeps them for it alone', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, noCursor);
      // echo, on claude, with claude-3-5-sonnet; then local, on the panel's provider, with the model it declares.
      await panel.add(0, 0, 0, 1, undefined, 0, 0);

      expect(panel.fake.choices[1]).toEqual({
        title: 'Provider de echo',
        description: 'Quem roda echo, entre os que ele declara. Esc usa o do painel.',
        options: [
          { label: 'claude', detail: 'instalado', current: false },
          { label: 'cursor', detail: 'não instalado', current: false },
        ],
      });
      expect(panel.fake.choices[2]).toEqual({
        title: 'Modelo de echo',
        description: 'Os modelos que echo declara para claude. Esc usa o do painel.',
        options: [{ label: 'claude-3-5-sonnet', detail: '', current: false }],
      });
      expect(panel.state.values.get('agente')).toBe('echo,local');
      expect([...panel.state.values].filter(([key]) => key.includes(':'))).toEqual([
        ['provider:echo', 'claude'],
        ['modelo:echo', 'claude-3-5-sonnet'],
        ['modelo:local', 'claude-3-5-sonnet'],
      ]);
      expect(panel.state.cards.get('echo')?.summary?.[0]).toBe(
        `${painted('green', 'claude')} ${gray('·')} ${painted('green', 'claude-3-5-sonnet')}`,
      );
      // local keeps the model chosen for it, whatever the panel's model.
      await panel.run('model', 1);
      const local = loadAgent(tmp.path, 'local');
      expect(sessionArgv(panel.state.context, local, [], 'x')).toEqual(['local', '--model', 'claude-3-5-sonnet', 'x']);
      expect(panel.fake.written.slice(0, 2)).toEqual([
        `Agente ${painted('green', 'echo')} adicionado.`,
        `Agente ${painted('green', 'local')} adicionado.`,
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it("takes the panel's with Esc, and leaves out an agent that cannot take them", async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const ollama = session(tmp.path, noCursor, 'claude-ollama');
      await ollama.add(0, undefined);
      expect(ollama.fake.choices).toHaveLength(2);
      expect(ollama.fake.written).toEqual([
        warn('O agente echo não entra: O agente echo não declara o provider claude-ollama (declara: claude, cursor).'),
      ]);
      expect(ollama.state.values.get('agente')).toBeUndefined();
      // local takes it, and the model claude-ollama needs: the first it declares.
      await ollama.add(1, undefined, undefined);
      expect(ollama.state.values.get('agente')).toBe('local');
      expect(ollama.state.cards.get('local')?.summary?.[0]).toContain('qwen3.5:4b');

      const panel = session(tmp.path, noCursor, 'claude');
      await panel.run('model', 1);
      // A provider chosen that is not installed keeps the agent out.
      await panel.add(0, 1);
      expect(panel.fake.written.at(-1)).toBe(
        warn('O agente echo não entra: o provider cursor não está instalado nesta máquina.'),
      );
      expect(panel.state.values.get('provider:echo')).toBeUndefined();
      // echo enters on the panel's; local, on claude-ollama, cannot take the panel's model and stays out, and the
      // next one is asked again.
      await panel.add(0, undefined, undefined, 1, 1, undefined, 0);
      expect(panel.state.values.get('agente')).toBe('echo');
      expect(panel.fake.written.at(-1)).toBe(
        warn(
          'O agente local não entra: O modelo claude-3-5-sonnet não está entre os de claude-ollama no agente local (qwen3.5:4b).',
        ),
      );
      expect(panel.fake.choices.at(-1)?.title).toBe('Depois de echo');
      expect([...panel.state.values.keys()].filter((key) => key.includes(':'))).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('/agents, changing an agent of the sequence', () => {
  it('keeps the provider and the model it had when the new ones cannot run it', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, noCursor);
      await panel.add(0, 0, 0, 0);
      expect(panel.state.values.get('provider:echo')).toBe('claude');
      // echo again, on cursor, which is not installed: it stays on claude, with its model.
      await panel.add(0, 1);
      expect(panel.fake.written.at(-1)).toBe(
        warn('O agente echo fica como estava: o provider cursor não está instalado nesta máquina.'),
      );
      expect([panel.state.values.get('provider:echo'), panel.state.values.get('modelo:echo')]).toEqual([
        'claude',
        'claude-3-5-sonnet',
      ]);
      expect(panel.state.values.get('agente')).toBe('echo');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('/provider', () => {
  it("is the panel's: auto and every provider, saying which are installed, shown in the header from the start", async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, noCursor);
      expect(panel.why('provider')).toBeUndefined();
      showRun(panel.container, panel.state.context);
      expect([...panel.state.labels]).toEqual([
        ['provider', `${bold('claude')}${gray(' (auto)')}`],
        ['modelo', gray('padrão de cada agente')],
      ]);
      await panel.run('provider', undefined);
      expect(panel.fake.choices[0]).toEqual({
        title: 'Escolha o provider do painel',
        description: 'Quem roda os agentes que não têm um seu. auto usa o primeiro instalado.',
        options: [
          { label: 'auto', detail: 'o primeiro instalado', current: true },
          { label: 'claude', detail: 'instalado', current: false },
          { label: 'claude-ollama', detail: 'instalado', current: false },
          { label: 'cursor', detail: 'não instalado', current: false },
        ],
      });

      await panel.run('provider', 3);
      expect(panel.fake.written).toEqual([warn('O provider cursor não está instalado nesta máquina.')]);
      await panel.run('provider', 1);
      expect(panel.state.values.get('provider')).toBe('claude');
      expect(panel.fake.written[1]).toBe(`Provider ${bold('claude')} selecionado.`);
      expect(panel.state.labels.get('provider')).toBe(bold('claude'));
      await panel.run('provider', 1);
      expect(panel.fake.written).toHaveLength(2);

      const none = session(tmp.path, () => false);
      showRun(none.container, none.state.context);
      expect([...none.state.labels]).toEqual([
        ['provider', warn('auto')],
        ['modelo', gray('—')],
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it("keeps the panel's model when the new provider runs it, and goes back to the default when not", async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      // Under auto, the first installed: claude.
      const panel = session(tmp.path, noCursor);
      await panel.run('model', 1);
      expect(panel.state.values.get('modelo')).toBe('claude-3-5-sonnet');

      await panel.run('provider', 1);
      expect(panel.state.values.get('modelo')).toBe('claude-3-5-sonnet');
      await panel.run('provider', 2);
      expect(panel.state.values.get('modelo')).toBeUndefined();
      expect(panel.fake.written).toContain(warn('O modelo claude-3-5-sonnet não é do novo provider: volta ao padrão.'));
    } finally {
      tmp.cleanup();
    }
  });
});

describe('/model', () => {
  it("is the panel's: each agent's first model by default, and the models the agents declare for it", async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude');
      expect(panel.why('model')).toBeUndefined();
      await panel.run('model', 1);

      expect(panel.fake.choices[0]).toEqual({
        title: 'Escolha o modelo do painel',
        description: 'Os modelos que os agentes declaram para claude, para os que não têm um seu.',
        options: [
          { label: 'padrão de cada agente', detail: 'o primeiro que ele declara', current: true },
          { label: 'claude-3-5-sonnet', detail: '', current: false },
        ],
      });
      expect(panel.state.values.get('modelo')).toBe('claude-3-5-sonnet');
      expect(panel.state.labels.get('modelo')).toBe(bold('claude-3-5-sonnet'));
      expect(panel.fake.written.at(-1)).toBe(`Modelo ${bold('claude-3-5-sonnet')} selecionado.`);

      await panel.run('model', 1);
      await panel.run('model', 99);
      await panel.run('model', undefined);
      expect(panel.fake.written).toHaveLength(1);

      await panel.run('model', 0);
      expect(panel.state.values.get('modelo')).toBeUndefined();
      expect(panel.state.labels.get('modelo')).toBe(gray('padrão de cada agente'));

      const ollama = session(tmp.path, () => true, 'claude-ollama');
      await ollama.run('model', 0);
      expect(ollama.fake.choices[0]?.options.map((option) => option.label)).toEqual(['qwen3.5:4b']);
    } finally {
      tmp.cleanup();
    }
  });

  it('is unavailable with no provider installed, or when no agent declares a model its provider needs', async () => {
    const tmp = makeTmpDir('choices');
    try {
      cpSync(join(FIXTURES, 'echo'), join(tmp.path, 'echo'), { recursive: true });
      const none = session(tmp.path, () => false);
      expect(none.why('model')).toBe('O provider do painel não está instalado: escolha outro com /provider');
      await none.run('model', 0);
      expect(none.fake.choices).toEqual([]);

      expect(session(tmp.path, () => true, 'claude-ollama').why('model')).toBe(
        'Nenhum agente declara modelos de claude-ollama',
      );
      // With no agents folder, the provider's own default.
      expect(session(join(tmp.path, 'missing'), () => true, 'claude').why('model')).toBeUndefined();
    } finally {
      tmp.cleanup();
    }
  });
});

describe('/mode', () => {
  it("lists the agent's modes with what each does, takes one, and is unavailable with no agent", async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true);
      expect(panel.why('mode')).toBe('Escolha um agente antes, com /agents');
      await panel.run('mode', 0);
      expect(panel.fake.choices).toEqual([]);

      await panel.add(0, undefined, undefined, 0);
      expect(panel.state.statuses.get('modo')).toBe(
        `${gray('modo')} ${bold('execute')}${gray(' | ')}${gray('plan')}${gray(' | ')}${gray('ask')} ${gray('(shift+tab alterna)')}`,
      );
      await panel.run('mode', 1);
      expect(panel.fake.choices[4]?.options.map((option) => [option.label, option.current])).toEqual([
        ['execute', true],
        ['plan', false],
        ['ask', false],
      ]);
      expect(panel.fake.choices[4]?.options[1]?.detail).toContain('Só planeja');
      expect(panel.state.values.get('modo')).toBe('plan');
      expect(panel.fake.written.at(-1)).toBe(`Modo ${bold('plan')} selecionado.`);
      expect(panel.state.statuses.get('modo')).toContain(bold('plan'));

      await panel.run('mode', 1);
      await panel.run('mode', undefined);
      expect(panel.state.values.get('modo')).toBe('plan');
      expect(panel.why('mode')).toBeUndefined();
    } finally {
      tmp.cleanup();
    }
  });

  it('moves with Shift+Tab around the modes from the start, from one listener per session, and leaves other keys alone', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true);
      expect(panel.state.press('tab', true)).toBe(false);
      agentsShell.panelStart?.(panel.container, panel.state.context);

      // With no agent yet, every mode, starting at execute.
      expect(panel.state.statuses.get('modo')).toBe(
        `${gray('modo')} ${bold('execute')}${gray(' | ')}${gray('plan')}${gray(' | ')}${gray('ask')} ${gray('(shift+tab alterna)')}`,
      );
      expect(panel.state.press('tab', true)).toBe(true);
      expect(panel.state.values.get('modo')).toBe('plan');
      await panel.add(0, undefined, undefined, 0);
      await panel.add(1, undefined, undefined, 0);

      expect(panel.state.press('tab', true)).toBe(true);
      expect(panel.state.values.get('modo')).toBe('ask');
      panel.state.press('tab', true);
      expect(panel.state.values.get('modo')).toBe('execute');
      expect(panel.state.press('tab')).toBe(false);
      expect(panel.state.press('left', true)).toBe(false);

      panel.state.context.set('agente', 'gone');
      expect(panel.state.press('tab', true)).toBe(true);
      expect(panel.state.values.get('modo')).toBe('plan');
    } finally {
      tmp.cleanup();
    }
  });

  it('keeps the mode for another agent, which has its own model, and the model chosen for the first', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude');
      await panel.add(0, undefined, 0, 0);
      await panel.run('mode', 2);
      await panel.add(1, undefined, undefined, 0);

      expect(panel.state.values.get('modo')).toBe('ask');
      expect([panel.state.values.get('modelo:echo'), panel.state.values.get('modelo:local')]).toEqual([
        'claude-3-5-sonnet',
        undefined,
      ]);
      expect(panel.state.labels.get('modelo')).toBe(gray('padrão de cada agente'));
    } finally {
      tmp.cleanup();
    }
  });
});

describe('/sandbox', () => {
  it('lists local and docker with what each is, the configured one checked, and takes one for the session', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true);
      await panel.run('sandbox', 1);

      expect(panel.why('sandbox')).toBeUndefined();
      expect(panel.fake.choices[0]).toEqual({
        title: 'Escolha o sandbox',
        description: 'Onde o provider roda nesta sessão. O padrão vem de CHOL_SANDBOX.',
        options: [
          { label: 'local', detail: 'Nesta máquina, isolado com bwrap', current: true },
          { label: 'docker', detail: 'Num container do Docker', current: false },
        ],
      });
      expect(panel.state.values.get('sandbox')).toBe('docker');
      expect(panel.fake.written).toEqual([`Sandbox ${bold('docker')} selecionado.`]);

      await panel.run('sandbox', 1);
      await panel.run('sandbox', undefined);
      expect(panel.fake.written).toHaveLength(1);
      await panel.run('sandbox', 0);
      expect(panel.state.values.get('sandbox')).toBe('local');
    } finally {
      tmp.cleanup();
    }
  });

  it('refuses docker without Docker, saying so in the list too', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, (bin) => bin !== 'docker');
      await panel.run('sandbox', 1);

      expect(panel.fake.choices[0]?.options[1]?.detail).toBe('Docker não encontrado');
      expect(panel.fake.written).toEqual([
        warn('O sandbox docker precisa do comando docker, que não foi encontrado: instale o Docker ou use local.'),
      ]);
      expect(panel.state.values.has('sandbox')).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });
});
