import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  boldAnsi,
  CARD_RULE,
  Container,
  paintAnsi,
  parseColors,
  PLATFORM,
  THEME,
  ThemeService,
  WORKSPACE_ROOT,
  type PanelContext,
} from '@choliba/core';
import { fakeChatPanel, fakePlatform } from '@choliba/core/testing';

import { ProviderRegistry } from '../../common';
import { ClaudeAgentProvider, ClaudeOllamaAgentProvider, CursorAgentProvider } from '../../providers';
import { AGENT_PROVIDERS } from '../../agents/agents.constants';

import { agentsConfig } from '../../agents/agents-config';
import { agentsPanel } from '../../agents/agents-panel';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

/** An agents folder with `echo`, `with-project`, and copies of it that need a ticket, or may go without one. */
function agentsFolder(dir: string): void {
  for (const name of ['echo', 'with-project']) cpSync(join(FIXTURES, name), join(dir, name), { recursive: true });
  const withProject = readFileSync(join(FIXTURES, 'with-project', 'agent.yaml'), 'utf8');
  for (const [name, extra] of [
    ['ticketed', 'ticket_types: [story]\n'],
    ['optional', 'ticket_types: [story]\nallow_without_ticket: true\n'],
  ] as const) {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'agent.yaml'), `${withProject.replace('id: with-project', `id: ${name}`)}${extra}`);
  }
}

/** The `/agents` command on a container whose agents folder is `dir`, with a fake panel and context. */
/** The agent's name as the panel paints it: bold, in its color. */
const painted = (color: 'magenta' | 'red', text: string): string => boldAnsi(paintAnsi(color, text));

/** The `/agents` command on a fake machine that has the binaries `installed` says, every one by default. */
function withAgents(dir: string, provider = 'auto', installed: (bin: string) => boolean = () => true) {
  const container = new Container();
  container.provide(agentsConfig.token, () => ({ ...agentsConfig.read([]), agentsDir: dir, provider }));
  container.provide(WORKSPACE_ROOT, () => '/');
  const platform = fakePlatform({ which: (bin: string) => (installed(bin) ? `/usr/bin/${bin}` : null) });
  container.provide(PLATFORM, () => platform);
  container.provide(THEME, () => new ThemeService({}, platform.stdout, false, parseColors('agents.echo=magenta')));
  container.provide(
    AGENT_PROVIDERS,
    () => new ProviderRegistry([new ClaudeAgentProvider(), new ClaudeOllamaAgentProvider(), new CursorAgentProvider()]),
  );
  const labels = new Map<string, string>();
  const statuses = new Map<string, string>();
  const keyListeners: ((key: {
    readonly name: string;
    readonly ctrl: boolean;
    readonly shift?: boolean;
  }) => boolean)[] = [];
  const values = new Map<string, string>();
  const shown: [string, readonly string[] | undefined, string | undefined][] = [];
  const keys: (string | undefined)[] = [];
  const context: PanelContext = {
    get: (key) => values.get(key),
    set: (key, value) => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
    show: (title, card) => {
      shown.push([title, card?.lines, card?.summary]);
      keys.push(card?.key);
    },
    label: (name, value) => {
      if (value === undefined) labels.delete(name);
      else labels.set(name, value);
    },
    status: (name, line) => {
      if (line === undefined) statuses.delete(name);
      else statuses.set(name, line);
    },
    onKey: (listener) => {
      keyListeners.push(listener);
    },
    converse: () => undefined,
    busy: () => undefined,
    clear: () => undefined,
    onChange: () => undefined,
    spin: () => undefined,
  };
  const fake = fakeChatPanel();
  const [command] = agentsPanel;
  if (command === undefined) throw new Error('/agents');
  return {
    command,
    container,
    context,
    fake,
    values,
    shown,
    keys,
    labels,
    statuses,
    shiftTab: () => keyListeners.some((listener) => listener({ name: 'tab', ctrl: false, shift: true })),
    run: () => command.run({ container, panel: fake.panel, context }),
  };
}

describe('/agents', () => {
  it('chooses the active agent among the folder, marking the current one, and shows its card', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const agents = withAgents(tmp.path);
      expect([agents.command.name, agents.command.description]).toEqual([
        'agents',
        'Escolhe o agente que vai trabalhar',
      ]);
      expect(agents.command.unavailable?.(agents.context, agents.container)).toBeUndefined();

      await agents.run();
      expect(agents.fake.choices[0]).toMatchObject({
        title: 'Escolha o agente',
        description: 'O agente que vai trabalhar no projeto e no ticket ativos.',
      });
      expect(agents.fake.choices[0]?.options.map((option) => [option.label, option.current])).toEqual([
        ['echo', false],
        ['optional', false],
        ['ticketed', false],
        ['with-project', false],
      ]);
      expect(agents.values.get('agente')).toBe('echo');
      expect(agents.shown).toEqual([
        [
          'agente',
          [
            `${painted('magenta', 'Echo Agent')} \u001b[90m1.0.0\u001b[39m`,
            CARD_RULE,
            'Repete a tarefa recebida, usado nos testes deste pacote.',
            CARD_RULE,
            '\u001b[90msem projeto · claude-3-5-sonnet, gpt-4o\u001b[39m',
          ],
          `${painted('magenta', 'echo')} \u001b[90m1.0.0\u001b[39m`,
        ],
      ]);
      expect(agents.fake.written).toEqual([`Agente ativo: ${painted('magenta', 'echo')}.`]);

      await agents.run();
      expect(agents.fake.choices[1]?.options[0]?.current).toBe(true);
      expect(agents.shown).toHaveLength(1);
    } finally {
      tmp.cleanup();
    }
  });

  it('says in the card what each agent needs to run', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const agents = withAgents(tmp.path);
      const needs: string[] = [];
      for (const index of [1, 2, 3]) {
        agents.fake.answer(index);
        await agents.run();
        needs.push(agents.shown.at(-1)?.[1]?.[4] ?? '');
      }

      expect(needs).toEqual([
        '\u001b[90mprojeto · claude-3-5-sonnet\u001b[39m',
        '\u001b[90mprojeto e ticket · claude-3-5-sonnet\u001b[39m',
        '\u001b[90mprojeto · claude-3-5-sonnet\u001b[39m',
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it('keeps the agent when the choice is left with Esc', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const agents = withAgents(tmp.path);
      agents.fake.answer(undefined);
      await agents.run();

      expect([agents.values.size, agents.shown, agents.fake.written]).toEqual([0, [], []]);
    } finally {
      tmp.cleanup();
    }
  });

  it('is unavailable with no agent in the folder, or when the folder cannot be read, saying why', () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      const empty = withAgents(join(tmp.path, 'none'));
      expect(empty.command.unavailable?.(empty.context, empty.container)).toBe(
        'Nenhum agente na pasta de agentes. Traga um com `choliba add`',
      );

      const broken = new Container();
      broken.provide(agentsConfig.token, () => agentsConfig.read([]));
      broken.provide(WORKSPACE_ROOT, () => {
        throw new Error('Nenhuma pasta de trabalho do choliba acima de /');
      });
      expect(empty.command.unavailable?.(empty.context, broken)).toBe(
        'Nenhuma pasta de trabalho do choliba acima de /',
      );
    } finally {
      tmp.cleanup();
    }
  });

  it('shows in the header the provider and the model a run of the agent would take', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const echo = readFileSync(join(FIXTURES, 'echo', 'agent.yaml'), 'utf8');
      mkdirSync(join(tmp.path, 'local'));
      writeFileSync(
        join(tmp.path, 'local', 'agent.yaml'),
        echo.replace('id: echo', 'id: local').replace('  - gpt-4o\n', '  - ollama:qwen3.5:4b\n'),
      );
      const auto = withAgents(tmp.path, 'auto', (bin) => bin === 'claude');
      await auto.run();
      expect([...auto.labels]).toEqual([
        ['provider', '\u001b[1m\u001b[36mclaude\u001b[39m\u001b[22m\u001b[90m (auto)\u001b[39m'],
        ['modelo', '\u001b[90mpadrão do claude\u001b[39m'],
      ]);

      const ollama = withAgents(tmp.path, 'claude-ollama');
      ollama.fake.answer(1);
      await ollama.run();
      expect(ollama.values.get('agente')).toBe('local');
      expect([...ollama.labels]).toEqual([
        ['provider', '\u001b[1m\u001b[36mclaude-ollama\u001b[39m\u001b[22m'],
        ['modelo', '\u001b[1m\u001b[36mollama:qwen3.5:4b\u001b[39m\u001b[22m'],
      ]);

      const foreign = withAgents(tmp.path, 'claude-ollama');
      await foreign.run();
      expect(foreign.labels.get('modelo')).toBe('\u001b[33mindisponível\u001b[39m');
      expect(foreign.fake.written[1]).toContain('\u001b[33mO provider claude-ollama roda um modelo declarado');

      const none = withAgents(tmp.path, 'auto', () => false);
      await none.run();
      expect([...none.labels]).toEqual([
        ['provider', '\u001b[33mnenhum instalado\u001b[39m'],
        ['modelo', '\u001b[90m—\u001b[39m'],
      ]);
      expect(none.fake.written[1]).toBe(
        '\u001b[33mNenhum provider instalado para auto: o agente não roda nesta máquina.\u001b[39m',
      );
    } finally {
      tmp.cleanup();
    }
  });
});
