import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Container } from '@choliba/kernel';
import {
  PLATFORM,
  ProcessRunnerService,
  THEME,
  ThemeService,
  WORKSPACE_ROOT,
  type Panel,
  type PanelOptions,
} from '@choliba/shell';
import { BufferWritable, fakePlatform } from '@choliba/kernel/testing';
import { sandboxConfig } from '@choliba/sandbox';
import { fakeChatPanel, fakePanelContext } from '@choliba/tui/testing';

import { ProviderRegistry } from '@choliba/engine';
import { ClaudeAgentProvider } from '@choliba/providers';
import { agentsConfig } from '../../agents/agents/agents-config';
import { forgetSequence, restartSequence, resumeSequence, talkToAgent } from '../../agents/agents/agents-panel-run';
import { AGENT_PROVIDERS, AGENTS } from '../../agents/agents/agents.constants';
import { agentsPanel } from '../../panel';
import { AgentsService, type HostedRun } from '../../agents/agents/agents.service';
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
  container.provide(sandboxConfig.token, () => ({ ...sandboxConfig.read([]), mode: 'local' }));
  container.provide(WORKSPACE_ROOT, () => '/');
  const platform = fakePlatform({ which: (bin: string) => `/usr/bin/${bin}` });
  container.provide(PLATFORM, () => platform);
  container.provide(THEME, () => new ThemeService({}, platform.stdout, false, {}));
  container.provide(AGENT_PROVIDERS, () => new ProviderRegistry([new ClaudeAgentProvider()]));
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
  return { asked, state, fake, settle, container };
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
      expect(talk.state.spinning.has('echo')).toBe(true);

      const options = { title: 'echo', titleColor: 'green', footer: () => ['claude · 00:01'], hint: '' };
      const panel: Panel | undefined = await run?.host.panel(options as PanelOptions);
      panel?.write('olá\n');
      panel?.refresh();
      expect(talk.fake.written.at(-1)).toBe('olá\n');
      // The agent's lines go in its block, under its name.
      expect(talk.fake.voices.at(-1)).toBe('echo');
      expect(talk.state.cards.get('echo')?.state).toBe(gray('aguardando'));
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
      // Its card says how the run went.
      expect(talk.state.cards.get('echo')?.state).toBe('concluído · 0m00s');

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
      expect(talk.state.spinning.has('echo')).toBe(true);
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

  it('runs the agents of a sequence in order, the first with the message, the next with its own task', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo,with-project');
      talk.state.context.set('projeto', 'site');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      expect(talk.asked[0]?.argv).toEqual(['echo', 'faça']);

      // The ticket a run leaves is the session's.
      talk.asked[0]?.host.ticket?.('site-3');
      expect(talk.state.values.get('ticket')).toBe('site-3');
      talk.asked[0]?.end(0);
      await talk.settle();
      expect(talk.fake.choices.at(-1)).toEqual({
        title: 'Seguir para with-project?',
        description: 'Enter segue; Esc para a sequência, que /resume retoma.',
        options: [{ label: 'seguir', detail: 'with-project', current: true }],
      });
      expect(talk.asked[1]?.argv).toEqual(['with-project', '--project', 'site', 'Trabalhe no projeto.']);
      talk.asked[1]?.end(0);
      await talk.settle();
      expect(talk.state.values.has('retomar')).toBe(false);
      expect(talk.fake.written.at(-1)).toBe(`with-project terminou: ${bold('código 0')} ${gray('· 0s')}`);
    } finally {
      tmp.cleanup();
    }
  });

  it('stops a sequence on a failure, an Esc or Ctrl+C, and /resume resumes it from where it stopped', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo,with-project');
      talk.state.context.set('projeto', 'site');

      // A failure stops it at the agent that failed. /resume while it runs does nothing.
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      resumeSequence(talk.state.context, talk.fake.panel, 0);
      talk.asked[0]?.end(1);
      await talk.settle();
      expect(talk.state.values.get('retomar')).toBe('0');
      expect(talk.fake.written.at(-1)).toBe(warn('A sequência parou em echo. /resume retoma dele.'));
      expect(talk.state.cards.get('echo')?.state).toBe(warn('falhou · 0m00s'));

      // Esc at the pause stops it before the next one.
      resumeSequence(talk.state.context, talk.fake.panel, 0);
      await talk.settle();
      // Resumed, echo has no default task: it takes the message that started the sequence.
      expect(talk.asked[1]?.argv).toEqual(['echo', 'faça']);
      talk.fake.answerNext(undefined);
      // The ticket the session keeps is the one /resume resumes with.
      talk.state.context.set('ticket', 'app-1');
      talk.asked[1]?.end(0);
      await talk.settle();
      expect(talk.state.values.get('retomar')).toBe('1');
      expect(talk.fake.written.at(-1)).toBe(
        warn('A sequência parou em with-project. /resume retoma dele, com o ticket app-1.'),
      );

      // Ctrl+C stops the run and the sequence, at the agent it stopped.
      resumeSequence(talk.state.context, talk.fake.panel, 1);
      await talk.settle();
      expect(talk.asked[2]?.argv[0]).toBe('with-project');
      talk.state.stop();
      talk.asked[2]?.end(0);
      await talk.settle();
      expect(talk.state.values.get('retomar')).toBe('1');

      // Back to the first, with something new to say to it: it takes that, and the sequence's message stays.
      resumeSequence(talk.state.context, talk.fake.panel, 0, 'só a busca');
      await talk.settle();
      expect(talk.asked[3]?.argv).toEqual(['echo', 'só a busca']);
    } finally {
      tmp.cleanup();
    }
  });

  it('restarts the running agent when /sandbox chooses another, and keeps the next one when none runs yet', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const sandbox = agentsPanel.find((command) => command.name === 'sandbox');
      const talk = conversation(tmp.path, 'echo,with-project');
      talk.state.context.set('projeto', 'site');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();

      talk.fake.answer(1);
      const changing = sandbox?.run({
        container: talk.container,
        panel: talk.fake.panel,
        context: talk.state.context,
      });
      expect(talk.fake.choices.at(-1)).toEqual({
        title: 'Escolha o sandbox',
        description: 'Trocar reinicia a execução no sandbox novo.',
        options: [
          { label: 'local', detail: 'Nesta máquina, isolado com bwrap', current: true },
          { label: 'docker', detail: 'Num container do Docker', current: false },
        ],
      });
      await talk.settle();
      talk.asked[0]?.end(1);
      await changing;
      await talk.settle();

      expect(talk.state.values.get('sandbox')).toBe('docker');
      expect(talk.fake.written).toEqual([`Sandbox ${bold('docker')} selecionado.`, 'Reiniciando a execução.']);
      expect(talk.asked).toHaveLength(2);
      expect(talk.asked[1]?.argv).toEqual(['echo', '--sandbox', 'docker', 'faça']);

      talk.fake.answerNext(0);
      talk.asked[1]?.end(0);
      await talk.settle();
      expect(talk.asked[2]?.argv).toEqual([
        'with-project',
        '--project',
        'site',
        '--sandbox',
        'docker',
        'Trabalhe no projeto.',
      ]);
    } finally {
      tmp.cleanup();
    }
  });

  it('restarts once for two restarts at the same time, and not at all when no agent runs', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      await restartSequence(talk.state.context, talk.fake.panel);
      expect(talk.asked).toHaveLength(0);

      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      const first = restartSequence(talk.state.context, talk.fake.panel);
      const second = restartSequence(talk.state.context, talk.fake.panel);
      talk.asked[0]?.end(1);
      await Promise.all([first, second]);
      await talk.settle();

      expect(talk.asked.map((run) => run.argv)).toEqual([
        ['echo', 'faça'],
        ['echo', 'faça'],
      ]);
      expect(talk.fake.written.filter((line) => line.includes('terminou'))).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });

  it('tells each agent what the others of the session concluded, a stopped one too, until the session forgets', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo,with-project');
      talk.state.context.set('projeto', 'site');
      talk.state.send('escreva o ticket', talk.fake.panel);
      await talk.settle();
      expect(talk.asked[0]?.host.conclusions).toEqual([]);

      talk.asked[0]?.host.concluded?.('o ticket está pronto');
      talk.fake.answerNext(0);
      talk.asked[0]?.end(0);
      await talk.settle();
      const echo = {
        agent: 'echo',
        task: 'escreva o ticket',
        reason: 'completed',
        exitCode: 0,
        conclusion: 'o ticket está pronto',
      };
      expect(talk.asked[1]?.host.conclusions).toEqual([echo]);

      talk.asked[1]?.host.concluded?.('parei: o CA-01 não é testável');
      talk.asked[1]?.end(1);
      await talk.settle();
      resumeSequence(talk.state.context, talk.fake.panel, 0, 'veja o que o with-project disse');
      await talk.settle();
      expect(talk.asked[2]?.host.conclusions).toEqual([
        echo,
        {
          agent: 'with-project',
          task: 'Trabalhe no projeto.',
          reason: 'failed',
          exitCode: 1,
          conclusion: 'parei: o CA-01 não é testável',
        },
      ]);
      talk.asked[2]?.end(1);
      await talk.settle();

      forgetSequence(talk.state.context);
      resumeSequence(talk.state.context, talk.fake.panel, 0, 'de novo');
      await talk.settle();
      expect(talk.asked[3]?.host.conclusions).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });

  it('asks before taking a task too short to mean one, and runs it only when confirmed', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      talk.fake.answerNext(1);
      talk.state.send('i', talk.fake.panel);
      await talk.settle();
      expect(talk.fake.choices.at(-1)).toEqual({
        title: 'Mandar "i" como tarefa?',
        description: 'É curta demais para uma tarefa: confira se não foi enviada por engano.',
        options: [{ label: 'Sim, mandar' }, { label: 'Não' }],
      });
      expect(talk.asked).toHaveLength(0);

      talk.fake.answerNext(0);
      talk.state.send('ok', talk.fake.panel);
      await talk.settle();
      expect(talk.asked.map((run) => run.argv)).toEqual([['echo', 'ok']]);
    } finally {
      tmp.cleanup();
    }
  });

  it('offers to go back to the agent a run hands the work back to, with why as its task, or says /resume will', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo,with-project');
      talk.state.context.set('projeto', 'site');
      talk.state.send('escreva o ticket', talk.fake.panel);
      await talk.settle();
      expect(talk.asked[0]?.host.sessionAgents).toEqual(['echo', 'with-project']);
      talk.fake.answerNext(0);
      talk.asked[0]?.end(0);
      await talk.settle();

      talk.asked[1]?.host.concluded?.('parei.\nHand back to: echo — o CA-01 não é testável');
      talk.fake.answerNext(0);
      talk.asked[1]?.end(1);
      await talk.settle();
      await talk.settle();
      expect(talk.fake.written).toContain(warn('with-project devolveu o trabalho a echo: o CA-01 não é testável.'));
      expect(talk.fake.choices.at(-1)).toEqual({
        title: 'Voltar a echo?',
        description: 'Ele recebe o que os outros agentes concluíram, e o motivo como tarefa.',
        options: [{ label: 'Voltar a echo' }, { label: 'Parar aqui' }],
      });
      expect(talk.asked[2]?.argv).toEqual(['echo', 'o CA-01 não é testável']);

      talk.asked[2]?.host.concluded?.('Hand back to: with-project');
      talk.fake.answerNext(1);
      talk.asked[2]?.end(0);
      await talk.settle();
      await talk.settle();
      expect(talk.asked).toHaveLength(3);
      expect(talk.fake.written.at(-1)).toBe(warn('/resume volta a with-project quando quiser.'));

      // An agent gone from the session while the panel asked is not gone back to.
      const leaving = {
        ...talk.fake.panel,
        choose: () => {
          talk.state.context.set('agente', 'with-project,ticketed');
          return Promise.resolve(0);
        },
      };
      resumeSequence(talk.state.context, leaving, 1, undefined);
      await talk.settle();
      talk.asked[3]?.host.concluded?.('Hand back to: echo');
      talk.asked[3]?.end(1);
      await talk.settle();
      await talk.settle();
      expect(talk.asked).toHaveLength(4);
      expect(talk.fake.written.at(-1)).toBe(warn('/resume volta a echo quando quiser.'));
    } finally {
      tmp.cleanup();
    }
  });

  it('goes back, on a hand-back with no why, with the task the agent would run anyway', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo,with-project');
      talk.state.context.set('projeto', 'site');
      talk.state.send('escreva o ticket', talk.fake.panel);
      await talk.settle();
      talk.fake.answerNext(0);
      talk.asked[0]?.end(0);
      await talk.settle();
      talk.asked[1]?.host.concluded?.('Hand back to: echo');
      talk.fake.answerNext(0);
      talk.asked[1]?.end(1);
      await talk.settle();
      await talk.settle();

      expect(talk.fake.written).toContain(warn('with-project devolveu o trabalho a echo.'));
      expect(talk.asked[2]?.argv).toEqual(['echo', 'escreva o ticket']);
    } finally {
      tmp.cleanup();
    }
  });

  it('runs at the end of the sequence an agent added while it goes', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'echo');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();
      talk.state.context.set('projeto', 'app');
      talk.state.context.set('agente', 'echo,with-project');
      talk.asked[0]?.end(0);
      await talk.settle();
      expect(talk.fake.choices.at(-1)?.title).toBe('Seguir para with-project?');
      expect(talk.asked[1]?.argv[0]).toBe('with-project');
    } finally {
      tmp.cleanup();
    }
  });

  it('stops a sequence at an agent that no longer loads, and does nothing to resume on a session without one', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'gone,echo');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();

      expect(talk.state.values.get('retomar')).toBe('0');
      expect(talk.fake.written).toEqual([
        warn('O agente gone não carrega mais: veja com choliba check.'),
        warn('A sequência parou em gone. /resume retoma dele.'),
      ]);
      const other = fakeChatPanel();
      resumeSequence(fakePanelContext().context, other.panel, 0);
      expect(other.written).toEqual([]);
    } finally {
      tmp.cleanup();
    }
  });

  it('runs nothing for an agent that no longer loads, and says so', async () => {
    const tmp = makeTmpDir('panel-run');
    try {
      agentsFolder(tmp.path);
      const talk = conversation(tmp.path, 'gone');
      talk.state.send('faça', talk.fake.panel);
      await talk.settle();

      expect([talk.asked, talk.fake.written]).toEqual([
        [],
        [warn('O agente gone não carrega mais: veja com choliba check.')],
      ]);
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
      const ticket = (): void => undefined;
      expect(
        await service.runHosted(['nada'], { panel: () => Promise.resolve(undefined), stdout, stderr, ticket }),
      ).toBe(1);
      const concluded = (): void => undefined;
      expect(
        await service.runHosted(['nada'], {
          panel: () => Promise.resolve(undefined),
          stdout,
          stderr,
          conclusions: [],
          concluded,
          sessionAgents: ['nada'],
        }),
      ).toBe(1);
      expect(opened).toEqual([]);
      expect(platform.stdout.text()).toBe('');
    } finally {
      tmp.cleanup();
    }
  });
});

describe('AgentsService without app help handlers', () => {
  it('still validates run and list arguments when no help renderer is supplied', async () => {
    const tmp = makeTmpDir('agents-help');
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

      expect(await service.run(['echo', '--project', 'demo'])).toBe(1);
      expect(service.list(['--not-a-flag'])).toBe(1);
      expect(platform.stderr.text()).toContain('opção desconhecida: --project');
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
