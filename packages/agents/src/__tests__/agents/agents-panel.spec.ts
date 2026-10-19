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
const painted = (color: 'magenta' | 'red' | 'cyan' | 'green' | 'yellow', text: string): string =>
  boldAnsi(paintAnsi(color, text));

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
  const shown: [string, readonly string[] | undefined, readonly string[] | undefined, string | undefined][] = [];
  const keys: (string | undefined)[] = [];
  // Each card shown: its title, whether it is joined to the one before, and its left border's color.
  const placed: [string, boolean | undefined, string | undefined][] = [];
  const context: PanelContext = {
    get: (key) => values.get(key),
    set: (key, value) => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    },
    show: (title, card) => {
      shown.push([title, card?.lines, card?.summary, card?.color]);
      keys.push(card?.key);
      placed.push([title, card?.joined, card?.stripe]);
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
    onCardMove: () => undefined,
    converse: () => undefined,
    busy: () => undefined,
    clear: () => undefined,
    quit: () => Promise.resolve(),
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
    placed,
    keys,
    labels,
    statuses,
    shiftTab: () => keyListeners.some((listener) => listener({ name: 'tab', ctrl: false, shift: true })),
    run: () => command.run({ container, panel: fake.panel, context }),
  };
}

describe('/agents', () => {
  it('adds the agent chosen, marking the ones in the sequence, and shows its card', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const agents = withAgents(tmp.path);
      expect([agents.command.name, agents.command.description]).toEqual([
        'agents',
        'Acrescenta agentes à sequência, ou troca o provider e o modelo de um',
      ]);
      expect(agents.command.unavailable?.(agents.context, agents.container)).toBeUndefined();

      await agents.run();
      expect(agents.fake.choices[0]).toMatchObject({
        title: 'Escolha o agente',
        description: 'Um agente da sequência (marcado) troca o provider e o modelo; outro entra no fim dela.',
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
          'echo',
          [
            `${painted('magenta', 'Echo Agent')} \u001b[90m1.0.0\u001b[39m`,
            CARD_RULE,
            'Repete a tarefa recebida, usado nos testes deste pacote.',
          ],
          [
            `${painted('magenta', 'claude')} \u001b[90m·\u001b[39m \u001b[90mpadrão do claude\u001b[39m`,
            '\u001b[90msem ticket\u001b[39m',
          ],
          'magenta',
        ],
      ]);
      expect(agents.fake.written).toEqual([`Agente ${painted('magenta', 'echo')} adicionado.`]);

      // Chosen again, it is in the sequence: it chooses its provider and its model again, and stays where it is.
      await agents.run();
      expect(agents.fake.choices[4]?.options[0]?.current).toBe(true);
      expect(agents.fake.choices[5]?.title).toBe('Provider de echo');
      expect(agents.values.get('agente')).toBe('echo');
      expect(agents.fake.written.at(-1)).toBe(`Agente ${painted('magenta', 'echo')} atualizado.`);
      expect(agents.shown.map(([title]) => title)).toEqual(['echo', 'echo']);
      // Another one is added at the end; Esc on the next question ends the additions.
      agents.fake.answerNext(1, undefined, undefined, undefined);
      await agents.run();
      expect(agents.values.get('agente')).toBe('echo,optional');
    } finally {
      tmp.cleanup();
    }
  });

  it('builds a sequence one agent after another, adds to its end, and never starts it over', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const agents = withAgents(tmp.path);
      // echo, then ticketed (2nd of the rest), then optional (1st of what is left), then "nenhum outro"; each on the
      // panel's provider and model (Esc).
      const esc = undefined;
      agents.fake.answerNext(0, esc, esc, 2, esc, esc, 1, esc, esc, 0);
      await agents.run();

      expect(agents.values.get('agente')).toBe('echo,ticketed,optional');
      expect(agents.fake.choices[3]).toMatchObject({
        title: 'Depois de echo',
        description: 'O próximo agente da sequência, que roda quando o anterior termina e você confirma.',
      });
      expect(agents.fake.choices[3]?.options.map((option) => [option.label, option.current])).toEqual([
        ['nenhum outro', true],
        ['optional', false],
        ['ticketed', false],
        ['with-project', false],
      ]);
      expect(agents.fake.choices[6]?.title).toBe('Depois de echo → ticketed');
      // A card per agent, in its order, each joined to the one before and bordered in its color, shown as it is picked.
      expect(agents.placed).toEqual([
        ['echo', false, 'magenta'],
        ['echo', false, 'magenta'],
        ['ticketed', true, 'cyan'],
        ['echo', false, 'magenta'],
        ['ticketed', true, 'cyan'],
        ['optional', true, 'magenta'],
      ]);

      // Another /agents adds at the end; with every agent in it, nothing is left to ask after.
      agents.placed.length = 0;
      agents.fake.answerNext(3, esc, esc);
      await agents.run();
      expect(agents.values.get('agente')).toBe('echo,ticketed,optional,with-project');
      expect(agents.fake.written.at(-1)).toBe(`Agente ${painted('yellow', 'with-project')} adicionado.`);
      expect(agents.placed.map(([title, joined]) => [title, joined])).toEqual([
        ['echo', false],
        ['ticketed', true],
        ['optional', true],
        ['with-project', true],
      ]);
      // One in it, chosen again, changes its provider and its model: the sequence stays.
      agents.fake.answerNext(2, esc, esc);
      await agents.run();
      expect(agents.values.get('agente')).toBe('echo,ticketed,optional,with-project');
      expect(agents.fake.written.at(-1)).toBe(`Agente ${painted('cyan', 'ticketed')} atualizado.`);
      // Esc on the list changes nothing.
      agents.fake.answerNext(undefined);
      await agents.run();
      expect(agents.values.get('agente')).toBe('echo,ticketed,optional,with-project');
    } finally {
      tmp.cleanup();
    }
  });

  it('offers /resume only when a sequence stopped, and resumes it', async () => {
    const tmp = makeTmpDir('agents-panel');
    try {
      agentsFolder(tmp.path);
      const agents = withAgents(tmp.path);
      const resume = agentsPanel.find((command) => command.name === 'resume');
      expect(resume?.description).toBe('Retoma a sequência de agentes de onde ela parou');
      expect(resume?.unavailable?.(agents.context, agents.container)).toBe('Nenhuma sequência parada para retomar');
      agents.context.set('retomar', '1');
      expect(resume?.unavailable?.(agents.context, agents.container)).toBeUndefined();
      await resume?.run({ container: agents.container, panel: agents.fake.panel, context: agents.context });
      expect(agents.fake.written).toEqual([]);
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
        echo
          .replace('id: echo', 'id: local')
          .replace('  cursor:\n    models:\n      - gpt-4o\n', "  claude-ollama:\n    models:\n      - 'qwen3.5:4b'\n"),
      );
      // The header's column is the panel's: what an agent added with Esc takes.
      const auto = withAgents(tmp.path, 'auto', (bin) => bin === 'claude');
      auto.fake.answerNext(0, undefined, undefined, 0);
      await auto.run();
      expect([...auto.labels]).toEqual([
        ['provider', '\u001b[1m\u001b[36mclaude\u001b[39m\u001b[22m\u001b[90m (auto)\u001b[39m'],
        ['modelo', '\u001b[90mpadrão do claude\u001b[39m'],
      ]);

      const ollama = withAgents(tmp.path, 'claude-ollama');
      ollama.fake.answerNext(1, undefined, undefined, 0);
      await ollama.run();
      expect(ollama.values.get('agente')).toBe('local');
      expect(ollama.labels.get('provider')).toBe('\u001b[1m\u001b[36mclaude-ollama\u001b[39m\u001b[22m');
      // Its card: the first model it declares, which claude-ollama needs.
      expect(ollama.shown.at(-1)?.[2]?.[0]).toBe(
        `${painted('green', 'claude-ollama')} \u001b[90m·\u001b[39m ${painted('green', 'qwen3.5:4b')}`,
      );

      const foreign = withAgents(tmp.path, 'claude-ollama');
      foreign.fake.answerNext(0, undefined);
      await foreign.run();
      expect(foreign.values.get('agente')).toBeUndefined();
      expect(foreign.fake.written[0]).toContain(
        '\u001b[33mO agente echo não entra: O agente echo não declara o provider claude-ollama',
      );

      const none = withAgents(tmp.path, 'auto', () => false);
      none.fake.answerNext(0, undefined);
      await none.run();
      expect(none.fake.written[0]).toBe(
        '\u001b[33mO agente echo não entra: Nenhum provider que o agente echo declara está instalado: claude, cursor.\u001b[39m',
      );
    } finally {
      tmp.cleanup();
    }
  });
});
