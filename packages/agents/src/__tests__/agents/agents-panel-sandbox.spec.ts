import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Container, PLATFORM, WORKSPACE_ROOT, type PanelCard } from '@choliba/core';
import { fakePanelContext, fakePlatform } from '@choliba/core/testing';
import { sandboxConfig } from '@choliba/sandbox';

import { agentsConfig } from '../../agents/agents-config';
import { showSandboxCard, watchSandbox } from '../../agents/agents-panel-sandbox';
import { agentsShell } from '../../agents/agents-shell';
import { AGENTS } from '../../agents/agents.constants';
import type { AgentsService } from '../../agents/agents.service';
import type { DryRunInput } from '../../agents/runs/dry-run';
import { makeTmpDir } from '../helpers/tmp';

const FIXTURES = join(__dirname, '..', 'fixtures', 'agents');

/** `echo` (no project), `with-project`, and `ticketed`, which needs a ticket too. */
function agentsFolder(dir: string): void {
  for (const name of ['echo', 'with-project']) cpSync(join(FIXTURES, name), join(dir, name), { recursive: true });
  const withProject = readFileSync(join(FIXTURES, 'with-project', 'agent.yaml'), 'utf8');
  mkdirSync(join(dir, 'ticketed'));
  writeFileSync(
    join(dir, 'ticketed', 'agent.yaml'),
    `${withProject.replace('id: with-project', 'id: ticketed')}ticket_types: [story]\n`,
  );
}

const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

const LOCAL: Pick<DryRunInput, 'local'> = {
  local: {
    mounts: [
      { path: '/home/ana/loja', access: 'read', directory: true },
      { path: '/home/ana/loja/.cache/runs', access: 'write', directory: true },
      { path: '/srv/segredo', access: 'hidden', directory: true },
    ],
    skipped: [],
  },
};

/**
 * The sandbox card of a session whose sandbox is `sandbox` (`erro`: the configuration does not read), on a machine
 * with `docker` or not, and a fake `preview` that answers each preview in turn and records its command lines.
 */
function session(dir: string, sandbox = 'local', docker = true) {
  const previews: (readonly string[])[] = [];
  const answers: (() => DryRunInput | string)[] = [];
  const container = new Container();
  container.provide(agentsConfig.token, () => ({ ...agentsConfig.read([]), agentsDir: dir }));
  container.provide(WORKSPACE_ROOT, () => '/');
  container.provide(PLATFORM, () =>
    fakePlatform({
      env: { HOME: '/home/ana' },
      which: (bin) => (bin === 'docker' && !docker ? null : `/usr/bin/${bin}`),
    }),
  );
  container.provide(sandboxConfig.token, () => {
    if (sandbox === 'erro') throw new Error('CHOL_SANDBOX: use local ou docker');
    return { ...sandboxConfig.read([]), mode: sandbox };
  });
  const service = {
    preview: (argv: readonly string[]) => {
      previews.push(argv);
      return Promise.resolve((answers.shift() ?? (() => LOCAL as DryRunInput))());
    },
  };
  container.provide(AGENTS, () => service as unknown as AgentsService);
  const state = fakePanelContext();
  const card = (): Omit<PanelCard, 'title'> | undefined => state.cards.get('sandbox');
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { container, state, previews, answers, card, settle };
}

describe('the sandbox card', () => {
  it('shows from the start where a run would go, and asks for an agent to show what it mounts', async () => {
    const tmp = makeTmpDir('sandbox-card');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path);
      agentsShell.panelStart?.(panel.container, panel.state.context);

      expect(panel.card()).toEqual({
        lines: [
          `${bold('local')} ${gray('· bwrap')}`,
          '---',
          'Nesta máquina, isolado com bwrap: o provider só vê o que está montado.',
          gray('padrão (CHOL_SANDBOX)'),
          '---',
          gray('…'),
        ],
        summary: `${bold('local')} ${gray('padrão (CHOL_SANDBOX)')}`,
        key: 's',
        order: 1,
      });
      await panel.settle();
      expect(panel.card()?.lines.at(-1)).toBe(gray('Escolha um agente para ver o que a execução monta.'));
      expect(panel.previews).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });

  it("lists what the active agent's run would mount, the home folder as ~, with the session's choices", async () => {
    const tmp = makeTmpDir('sandbox-card');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path);
      watchSandbox(panel.container, panel.state.context);
      panel.state.context.set('agente', 'echo');
      panel.state.context.set('sandbox', 'local');
      await panel.settle();

      expect(panel.previews.at(-1)).toEqual(['echo', '--sandbox', 'local', 'prévia']);
      expect(panel.card()?.lines.slice(3)).toEqual([
        gray('escolhido nesta sessão'),
        '---',
        `${gray('leitura')} ~/loja`,
        `${gray('escrita')} ~/loja/.cache/runs`,
        `${gray('oculto ')} /srv/segredo`,
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it("shows a container's image and network over its mounts, and no mounts when the run would not go", async () => {
    const tmp = makeTmpDir('sandbox-card');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path, 'docker');
      panel.state.context.set('agente', 'echo');
      panel.answers.push(
        () =>
          ({
            container: { image: 'choliba-agent', network: 'isolated', mounts: LOCAL.local?.mounts ?? [], skipped: [] },
          }) as unknown as DryRunInput,
        () => 'O provider cursor não foi encontrado.',
      );
      await showSandboxCard(panel.container, panel.state.context);
      expect(panel.card()?.lines[0]).toBe(`${bold('docker')} ${gray('· docker')}`);
      expect(panel.card()?.lines.slice(5, 8)).toEqual([
        gray('imagem choliba-agent · rede isolated'),
        '---',
        `${gray('leitura')} ~/loja`,
      ]);

      await showSandboxCard(panel.container, panel.state.context);
      expect(panel.card()?.lines.at(-1)).toBe(
        gray('A execução não roda com estas escolhas: sem montagens para mostrar.'),
      );
    } finally {
      tmp.cleanup();
    }
  });

  it('asks for a project, takes the chosen ticket, and previews a new one of the first type with none', async () => {
    const tmp = makeTmpDir('sandbox-card');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path);
      panel.state.context.set('agente', 'ticketed');
      await showSandboxCard(panel.container, panel.state.context);
      expect(panel.card()?.lines.at(-1)).toBe(gray('Escolha um projeto para ver o que ticketed monta.'));

      panel.state.context.set('projeto', 'site');
      await showSandboxCard(panel.container, panel.state.context);
      panel.state.context.set('ticket', 'site-1');
      await showSandboxCard(panel.container, panel.state.context);
      expect(panel.previews).toEqual([
        ['ticketed', '--project', 'site', '--type', 'story', 'prévia'],
        ['ticketed', '--project', 'site', '--ticket', 'site-1', 'prévia'],
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it('says in yellow why no run could go where the session puts it', async () => {
    const tmp = makeTmpDir('sandbox-card');
    try {
      agentsFolder(tmp.path);
      const missing = session(tmp.path, 'docker', false);
      await showSandboxCard(missing.container, missing.state.context);
      expect(missing.card()?.lines.slice(0, 5)).toEqual([
        `${warn('docker')} ${gray('· docker')}`,
        '---',
        'Num container do Docker: o provider só vê o que está montado.',
        gray('padrão (CHOL_SANDBOX)'),
        warn('O sandbox docker precisa do comando docker, que não foi encontrado: instale o Docker ou use local.'),
      ]);

      for (const [sandbox, why] of [
        ['vm', 'CHOL_SANDBOX="vm" não existe: use local ou docker.'],
        ['erro', 'CHOL_SANDBOX: use local ou docker'],
      ] as const) {
        const wrong = session(tmp.path, sandbox);
        await showSandboxCard(wrong.container, wrong.state.context);
        expect(wrong.card()?.lines.slice(0, 3)).toEqual([warn('indisponível'), '---', why]);
        expect(wrong.card()?.summary).toBe(warn('indisponível'));
      }
    } finally {
      tmp.cleanup();
    }
  });

  it('follows the choices it depends on and /clear, once per session, and keeps only the latest preview', async () => {
    const tmp = makeTmpDir('sandbox-card');
    try {
      agentsFolder(tmp.path);
      const panel = session(tmp.path);
      watchSandbox(panel.container, panel.state.context);
      watchSandbox(panel.container, panel.state.context);
      panel.state.context.set('agente', 'echo');
      await panel.settle();
      expect(panel.previews).toHaveLength(1);

      panel.state.context.set('outra', 'x');
      await panel.settle();
      expect(panel.previews).toHaveLength(1);

      let late: (answer: DryRunInput | string) => void = () => undefined;
      const slow = new Promise<DryRunInput | string>((resolve) => {
        late = resolve;
      });
      const service = panel.container.get(AGENTS) as unknown as { preview: (argv: readonly string[]) => unknown };
      const fast = service.preview;
      service.preview = () => slow;
      const first = showSandboxCard(panel.container, panel.state.context);
      service.preview = fast;
      await showSandboxCard(panel.container, panel.state.context);
      late('lenta');
      await first;
      expect(panel.card()?.lines.at(-1)).toBe(`${gray('oculto ')} /srv/segredo`);

      panel.state.context.clear();
      await panel.settle();
      expect(panel.card()?.lines.at(-1)).toBe(gray('Escolha um agente para ver o que a execução monta.'));
    } finally {
      tmp.cleanup();
    }
  });
});
