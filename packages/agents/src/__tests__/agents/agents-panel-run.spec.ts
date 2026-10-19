import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Container,
  ProcessRunnerService,
  ThemeService,
  WORKSPACE_ROOT,
  type Panel,
  type PanelOptions,
} from '@choliba/core';
import { BufferWritable, fakeChatPanel, fakePanelContext, fakePlatform } from '@choliba/core/testing';

import { ProviderRegistry } from '../../common';
import { ClaudeAgentProvider } from '../../providers';
import { agentsConfig } from '../../agents/agents-config';
import { talkToAgent } from '../../agents/agents-panel-run';
import { AGENTS } from '../../agents/agents.constants';
import { AgentsService, type HostedRun } from '../../agents/agents.service';
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

/** One run the conversation asked for: its command line, what the host lent, and how to end it. */
interface Asked {
  readonly argv: readonly string[];
  readonly host: HostedRun;
  readonly end: (code: number) => void;
  readonly fail: (error: unknown) => void;
}

/** The conversation of the active `agent`, on a fake service that records each run and ends it when told. */
function conversation(dir: string, agent: string) {
  const asked: Asked[] = [];
  const container = new Container();
  container.provide(agentsConfig.token, () => ({ ...agentsConfig.read([]), agentsDir: dir }));
  container.provide(WORKSPACE_ROOT, () => '/');
  const service = {
    runHosted: (argv: readonly string[], host: HostedRun) =>
      new Promise<number>((resolve, reject) => {
        asked.push({ argv, host, end: resolve, fail: reject });
      }),
  };
  container.provide(AGENTS, () => service as unknown as AgentsService);
  const state = fakePanelContext();
  state.context.set('agente', agent);
  const fake = fakeChatPanel();
  talkToAgent(container, state.context);
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { asked, state, fake, settle };
}

const bold = (text: string): string => `\u001b[1m\u001b[36m${text}\u001b[39m\u001b[22m`;
const gray = (text: string): string => `\u001b[90m${text}\u001b[39m`;
const warn = (text: string): string => `\u001b[33m${text}\u001b[39m`;

describe('talkToAgent', () => {
  it('runs the active agent with what is sent as its task, in the panel, until it ends', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      expect(talk.state.send('diga olá', talk.fake.panel)).toBe(true);
      await talk.settle();

      const [run] = talk.asked;
      expect(run?.argv).toEqual(['echo', 'diga olá']);
      expect(talk.fake.written).toEqual([]);
      expect(talk.state.spinning.has('agente')).toBe(true);

      const options = { title: 'echo', titleColor: 'green', footer: () => ['claude · 00:01'], hint: '' };
      const panel: Panel | undefined = await run?.host.panel(options as PanelOptions);
      panel?.write('olá\n');
      panel?.refresh();
      expect(talk.fake.written.at(-1)).toBe('olá\n');
      expect(talk.state.statuses.get('execução')).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      const sent: string[] = [];
      panel?.onMessage((text) => sent.push(text));
      talk.state.send('mais', talk.fake.panel);
      expect(sent).toEqual(['mais']);
      expect(talk.asked).toHaveLength(1);
      expect(await panel?.ask({ question: 'Qual?', options: [], multi: false })).toEqual({ status: 'skipped' });

      let interrupted = 0;
      panel?.onInterrupt(() => {
        interrupted += 1;
      });
      expect(talk.state.stop()).toBe(true);
      expect(interrupted).toBe(1);

      panel?.close();
      expect(talk.state.statuses.has('execução')).toBe(false);
      run?.end(0);
      await talk.settle();
      expect(talk.fake.written.at(-1)).toBe(`echo terminou: ${bold('código 0')} ${gray('· 0s')}`);
      expect(talk.state.spinning.size).toBe(0);

      talk.state.send('de novo', talk.fake.panel);
      await talk.settle();
      expect(talk.asked).toHaveLength(2);
    } finally {
      tmp.cleanup();
    }
  });

  it('ends a run that fails with an unexpected error in the conversation, and takes the next message', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      talk.asked[0]?.fail(new Error('ENOENT: no such file'));
      await talk.settle();

      expect(talk.fake.written.at(-1)).toBe(warn('echo parou por um erro: ENOENT: no such file'));
      expect(talk.state.spinning.size).toBe(0);
      talk.state.send('de novo', talk.fake.panel);
      await talk.settle();
      expect(talk.asked).toHaveLength(2);
      talk.asked[1]?.fail('texto');
      await talk.settle();
      expect(talk.fake.written.at(-1)).toBe(warn('echo parou por um erro: texto'));
    } finally {
      tmp.cleanup();
    }
  });

  it("stops a step's command on Ctrl+C outside the agent's session, the session inside it, and stays busy to the end", async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      const [run] = talk.asked;
      expect(run?.host.signal?.aborted).toBe(false);
      expect(talk.state.stop()).toBe(true);
      expect(run?.host.signal?.aborted).toBe(true);
      run?.end(1);
      await talk.settle();

      talk.state.send('de novo', talk.fake.panel);
      await talk.settle();
      const second = talk.asked[1];
      const panel = await second?.host.panel({ footer: () => [] } as unknown as PanelOptions);
      let interrupted = 0;
      panel?.onInterrupt(() => {
        interrupted += 1;
      });
      expect(talk.state.stop()).toBe(true);
      expect([interrupted, second?.host.signal?.aborted]).toEqual([1, false]);

      panel?.close();
      expect(talk.state.spinning.has('agente')).toBe(true);
      talk.state.send('enquanto os steps rodam', talk.fake.panel);
      await talk.settle();
      expect(talk.asked).toHaveLength(2);
      expect(talk.state.stop()).toBe(true);
      expect([interrupted, second?.host.signal?.aborted]).toEqual([1, true]);

      second?.end(1);
      await talk.settle();
      expect([talk.state.spinning.size, talk.state.stop()]).toEqual([0, false]);
    } finally {
      tmp.cleanup();
    }
  });

  it('says what the agent needs and the session lacks, and passes the choices as flags', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const project = conversation(tmp.path, 'with-project');
      project.state.send('faça', project.fake.panel);
      await project.settle();
      expect(project.fake.written).toEqual([warn('Escolha um projeto antes, com /projects.')]);
      expect(project.asked).toEqual([]);

      const ticket = conversation(tmp.path, 'ticketed');
      ticket.state.context.set('projeto', 'site');
      ticket.fake.answer(undefined);
      ticket.state.send('faça', ticket.fake.panel);
      await ticket.settle();
      expect(ticket.fake.choices).toEqual([
        {
          title: 'Ticket novo para ticketed',
          description:
            'Nenhum ticket escolhido: a execução cria um deste tipo. Esc cancela; /tickets escolhe um existente.',
          options: [{ label: 'story', detail: '', current: false }],
        },
      ]);
      expect([ticket.fake.written, ticket.asked]).toEqual([[], []]);

      ticket.fake.answer(0);
      ticket.state.send('crie', ticket.fake.panel);
      await ticket.settle();
      expect(ticket.asked[0]?.argv).toEqual(['ticketed', '--project', 'site', '--type', 'story', 'crie']);
      ticket.asked[0]?.end(0);
      await ticket.settle();

      for (const [key, value] of [
        ['ticket', 'site-1'],
        ['provider:ticketed', 'claude'],
        ['modelo:ticketed', 'sonnet'],
        ['modo', 'plan'],
        ['sandbox', 'docker'],
      ] as const) {
        ticket.state.context.set(key, value);
      }
      ticket.state.send('faça', ticket.fake.panel);
      await ticket.settle();
      expect(ticket.asked[1]?.argv).toEqual([
        'ticketed',
        '--project',
        'site',
        '--ticket',
        'site-1',
        '--provider',
        'claude',
        '--model',
        'sonnet',
        '--mode',
        'plan',
        '--sandbox',
        'docker',
        'faça',
      ]);

      const free = conversation(tmp.path, 'echo');
      free.state.context.set('projeto', 'site');
      free.state.context.set('ticket', 'site-1');
      free.state.send('faça', free.fake.panel);
      await free.settle();
      expect(free.asked[0]?.argv).toEqual(['echo', 'faça']);
    } finally {
      tmp.cleanup();
    }
  });

  it('answers what the run says before and after its session, and how it ended, in minutes when it took them', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      const now = jest.spyOn(Date, 'now').mockReturnValue(0);
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      const [run] = talk.asked;
      run?.host.stdout.write('preparando\n');
      run?.host.stdout.write('\n');
      run?.host.stderr.write('falhou\n');
      expect([run?.host.stdout.isTTY, run?.host.stdout.columns]).toEqual([true, 100]);
      expect(talk.state.stop()).toBe(true);

      now.mockReturnValue(134_000);
      run?.end(2);
      await talk.settle();
      now.mockRestore();
      expect(talk.fake.written).toEqual([
        'preparando',
        warn('falhou'),
        `echo terminou: ${warn('código 2')} ${gray('· 2m14s')}`,
      ]);
      expect(talk.state.stop()).toBe(false);

      talk.state.send('outra', talk.fake.panel);
      await talk.settle();
      let cleared = 0;
      const second = await talk.asked[1]?.host.panel({ footer: () => [] } as unknown as PanelOptions);
      second?.onInterrupt(() => {
        cleared += 1;
      });
      talk.state.context.clear();
      expect([cleared, talk.state.values.size]).toEqual([1, 0]);
    } finally {
      tmp.cleanup();
    }
  });

  it('does nothing with no active agent', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'gone');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();

      expect([talk.asked, talk.fake.written]).toEqual([[], []]);
    } finally {
      tmp.cleanup();
    }
  });
});

describe('AgentsService.runHosted', () => {
  it("runs the command line in the host's panel, its own lines in the host's streams", async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const platform = fakePlatform();
      const service = new AgentsService(
        () => tmp.path,
        { CHOL_AGENTS_DIR: tmp.path },
        new ProviderRegistry([]),
        new ProcessRunnerService({ spawner: platform.spawn }),
        new ThemeService({}, platform.stdout, false, {}),
        platform,
      );
      const stdout = new BufferWritable(true);
      const stderr = new BufferWritable();
      const opened: PanelOptions[] = [];

      const code = await service.runHosted(['nada'], {
        panel: (options) => {
          opened.push(options);
          return Promise.resolve(fakeChatPanel().panel);
        },
        stdout,
        stderr,
      });

      expect(code).toBe(1);
      expect(stderr.text() + stdout.text()).toContain('nada');
      const signal = new AbortController().signal;
      expect(
        await service.runHosted(['nada'], { panel: () => Promise.resolve(undefined), stdout, stderr, signal }),
      ).toBe(1);
      expect(opened).toEqual([]);
      expect(platform.stdout.text()).toBe('');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('AgentsService.preview', () => {
  it('gives what --dry-run would show as data, or what it says when the command line would not run', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      cpSync(join(FIXTURES, '..', 'skills'), join(tmp.path, '.choliba', 'skills'), { recursive: true });
      const platform = fakePlatform({ which: (bin) => `/usr/bin/${bin}` });
      const service = new AgentsService(
        () => tmp.path,
        { CHOL_AGENTS_DIR: tmp.path, CHOL_SANDBOX: 'docker' },
        new ProviderRegistry([new ClaudeAgentProvider()]),
        new ProcessRunnerService({ spawner: platform.spawn }),
        new ThemeService({}, platform.stdout, false, {}),
        platform,
      );

      const shown = await service.preview(['echo', 'prévia']);
      expect(shown).toMatchObject({ providerId: 'claude', container: { image: 'choliba-agent', network: 'isolated' } });
      const paths = typeof shown === 'string' ? [] : (shown.container?.mounts.map((mount) => mount.path) ?? []);
      expect(paths).toContain(join(tmp.path, '.choliba', 'skills', 'dummy-skill'));

      expect(await service.preview(['nada'])).toContain('nada');
      expect(platform.stdout.text()).toBe('');
    } finally {
      tmp.cleanup();
    }
  });
});
