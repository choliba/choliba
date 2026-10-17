import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Container,
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
import { showRun } from '../../agents/agents-panel-state';
import { AGENT_PROVIDERS } from '../../agents/agents.constants';
import { ClaudeAgentProvider, ClaudeOllamaAgentProvider, CursorAgentProvider } from '../../providers';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

/** `echo` (two models of no prefix) and `local` (one `ollama:` model), both taking every mode. */
function agentsFolder(dir: string): void {
  cpSync(join(FIXTURES, 'echo'), join(dir, 'echo'), { recursive: true });
  const echo = readFileSync(join(FIXTURES, 'echo', 'agent.yaml'), 'utf8');
  mkdirSync(join(dir, 'local'));
  writeFileSync(
    join(dir, 'local', 'agent.yaml'),
    echo.replace('id: echo', 'id: local').replace('  - gpt-4o\n', '  - ollama:qwen3.5:4b\n'),
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
  const why = (name: string): string | undefined => command(name).unavailable?.(state.context, container);
  return { fake, state, run, why, container };
}

const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

/** Every binary but the cursor provider's (`agent`, `cursor-agent`, `cursor agent`). */
const noCursor = (bin: string): boolean => !['agent', 'cursor-agent', 'cursor'].includes(bin);

describe('/provider', () => {
  it('takes the provider an agent of only ollama: models asks for, over CHOL_AGENTS_PROVIDER, until /provider', async () => {
    const tmp = makeTmpDir('choices-agent-provider');
    try {
      agentsFolder(tmp.path);
      const echo = readFileSync(join(FIXTURES, 'echo', 'agent.yaml'), 'utf8');
      mkdirSync(join(tmp.path, 'only'));
      writeFileSync(
        join(tmp.path, 'only', 'agent.yaml'),
        echo.replace('id: echo', 'id: only').replace('  - claude-3-5-sonnet\n  - gpt-4o\n', '  - ollama:qwen3.5:4b\n'),
      );
      const panel = session(tmp.path, noCursor, 'claude');
      panel.state.context.set('agente', 'only');
      showRun(panel.container, panel.state.context);

      expect(panel.state.labels.get('provider')).toBe(bold('claude-ollama'));
      await panel.run('provider', undefined);
      expect(panel.fake.choices[0]?.options.find((option) => option.current)?.label).toBe('claude-ollama');

      // A provider chosen in the session goes on winning.
      panel.state.context.set('provider', 'claude');
      showRun(panel.container, panel.state.context);
      expect(panel.state.labels.get('provider')).toBe(bold('claude'));
    } finally {
      tmp.cleanup();
    }
  });

  it('lists auto and each provider, saying which are installed, the chosen one checked', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, noCursor);
      await panel.run('provider', undefined);

      expect(panel.why('provider')).toBeUndefined();
      expect(panel.fake.choices[0]).toMatchObject({
        title: 'Escolha o provider',
        description: 'Quem roda o agente nesta sessão. auto usa o primeiro instalado.',
      });
      expect(panel.fake.choices[0]?.options).toEqual([
        { label: 'auto', detail: 'o primeiro instalado: claude', current: true },
        { label: 'claude', detail: 'instalado', current: false },
        { label: 'claude-ollama', detail: 'instalado', current: false },
        { label: 'cursor', detail: 'não instalado', current: false },
      ]);
      expect(panel.state.values.size).toBe(0);

      const none = session(tmp.path, () => false);
      await none.run('provider', 0);
      expect(none.fake.choices[0]?.options[0]?.detail).toBe('nenhum instalado');
    } finally {
      tmp.cleanup();
    }
  });

  it('takes an installed one for the session, and refuses one that is not installed', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, noCursor);
      await panel.run('provider', 3);
      expect(panel.fake.written).toEqual([warn('O provider cursor não está instalado nesta máquina.')]);
      expect(panel.state.values.get('provider')).toBeUndefined();

      await panel.run('provider', 1);
      expect(panel.state.values.get('provider')).toBe('claude');
      expect(panel.fake.written[1]).toBe(`Provider: ${bold('claude')}.`);
      expect(panel.state.labels.size).toBe(0);
      await panel.run('provider', 1);
      expect(panel.fake.written).toHaveLength(2);
    } finally {
      tmp.cleanup();
    }
  });

  it('keeps the chosen model when the new provider runs it, and goes back to the default when not', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude');
      await panel.run('agents', 0);
      await panel.run('model', 2);
      expect(panel.state.values.get('modelo')).toBe('gpt-4o');

      await panel.run('provider', 3);
      expect(panel.state.values.get('modelo')).toBe('gpt-4o');
      expect(panel.state.labels.get('provider')).toBe(bold('cursor'));

      await panel.run('provider', 2);
      expect(panel.state.values.get('modelo')).toBeUndefined();
      expect(panel.fake.written).toContain(warn('O modelo gpt-4o não roda com claude-ollama: volta ao padrão.'));
      expect(panel.state.labels.get('modelo')).toBe(warn('indisponível'));
    } finally {
      tmp.cleanup();
    }
  });
});

describe('/model', () => {
  it('is unavailable with no agent, with no provider installed, or when the provider runs none of its models', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude-ollama');
      expect(panel.why('model')).toBe('Escolha um agente antes, com /agents');
      await panel.run('model', 0);
      expect(panel.fake.choices).toEqual([]);

      await panel.run('agents', 0);
      expect(panel.why('model')).toBe('O provider claude-ollama não roda nenhum modelo de echo');

      const none = session(tmp.path, () => false);
      none.state.context.set('agente', 'echo');
      expect(none.why('model')).toBe('Nenhum provider instalado: escolha um com /provider');
    } finally {
      tmp.cleanup();
    }
  });

  it("lists the provider's default and the agent's models it runs, and takes one", async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude');
      await panel.run('agents', 0);
      expect(panel.why('model')).toBeUndefined();
      await panel.run('model', 1);

      expect(panel.fake.choices[1]).toEqual({
        title: 'Escolha o modelo de echo',
        description: 'Os modelos do agente que claude roda.',
        options: [
          { label: 'padrão do claude', detail: 'o provider escolhe', current: true },
          { label: 'claude-3-5-sonnet', detail: '', current: false },
          { label: 'gpt-4o', detail: '', current: false },
        ],
      });
      expect(panel.state.values.get('modelo')).toBe('claude-3-5-sonnet');
      expect(panel.state.labels.get('modelo')).toBe(bold('claude-3-5-sonnet'));
      expect(panel.fake.written.at(-1)).toBe(`Modelo: ${bold('claude-3-5-sonnet')}.`);

      await panel.run('model', 1);
      await panel.run('model', 99);
      await panel.run('model', undefined);
      expect(panel.state.values.get('modelo')).toBe('claude-3-5-sonnet');

      await panel.run('model', 0);
      expect(panel.state.values.get('modelo')).toBeUndefined();
      expect(panel.state.labels.get('modelo')).toBe(gray('padrão do claude'));
    } finally {
      tmp.cleanup();
    }
  });

  it('lists only the ollama models with a provider that runs those alone', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude-ollama');
      await panel.run('agents', 1);
      await panel.run('model', 0);

      expect(panel.fake.choices[1]?.options.map((option) => option.label)).toEqual(['ollama:qwen3.5:4b']);
      expect(panel.state.labels.get('modelo')).toBe(bold('ollama:qwen3.5:4b'));
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

      await panel.run('agents', 0);
      expect(panel.state.statuses.get('modo')).toBe(
        `${gray('modo')} ${bold('execute')}${gray(' · ')}${gray('plan')}${gray(' · ')}${gray('ask')} ${gray('(shift+tab alterna)')}`,
      );
      await panel.run('mode', 1);
      expect(panel.fake.choices[1]?.options.map((option) => [option.label, option.current])).toEqual([
        ['execute', true],
        ['plan', false],
        ['ask', false],
      ]);
      expect(panel.fake.choices[1]?.options[1]?.detail).toContain('Só planeja');
      expect(panel.state.values.get('modo')).toBe('plan');
      expect(panel.fake.written.at(-1)).toBe(`Modo: ${bold('plan')}.`);
      expect(panel.state.statuses.get('modo')).toContain(bold('plan'));

      await panel.run('mode', 1);
      await panel.run('mode', undefined);
      expect(panel.state.values.get('modo')).toBe('plan');
      expect(panel.why('mode')).toBeUndefined();
    } finally {
      tmp.cleanup();
    }
  });

  it('moves with Shift+Tab around the modes, from one listener per session, and leaves other keys alone', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true);
      expect(panel.state.press('tab', true)).toBe(false);
      await panel.run('agents', 0);
      await panel.run('agents', 1);

      expect(panel.state.press('tab', true)).toBe(true);
      expect(panel.state.values.get('modo')).toBe('plan');
      panel.state.press('tab', true);
      panel.state.press('tab', true);
      expect(panel.state.values.get('modo')).toBe('execute');
      expect(panel.state.press('tab')).toBe(false);
      expect(panel.state.press('left', true)).toBe(false);

      panel.state.context.set('agente', 'gone');
      expect(panel.state.press('tab', true)).toBe(false);
    } finally {
      tmp.cleanup();
    }
  });

  it('goes back to the default mode and model with another agent', async () => {
    const tmp = makeTmpDir('choices');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, () => true, 'claude');
      await panel.run('agents', 0);
      await panel.run('mode', 2);
      await panel.run('model', 1);
      await panel.run('agents', 1);

      expect([panel.state.values.get('modo'), panel.state.values.get('modelo')]).toEqual([undefined, undefined]);
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
      expect(panel.fake.written).toEqual([`Sandbox: ${bold('docker')}.`]);

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
