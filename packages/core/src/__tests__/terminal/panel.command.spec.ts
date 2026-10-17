import { coreShell, PANEL_ICON, PANEL_LOGO, PANEL_OPENER, PANEL_VERSION, type ShellModule } from '../../shell';
import type { ChatPanel, PanelOptions } from '../../terminal';
import {
  BufferWritable,
  fakeChatPanel as fakePanel,
  fakePlatform,
  replace,
  runShell,
  VERBS_ROOT,
  type FakePlatform,
} from '../../testing';

const ICON = { data: new Uint8Array(4), width: 1, height: 1, stride: 4 };

function terminal(args: readonly string[] = [], cwd = '/home/ana/loja'): FakePlatform {
  return fakePlatform({ argv: ['panel', ...args], cwd, env: { HOME: '/home/ana' }, stdout: new BufferWritable(true) });
}

describe('choliba panel', () => {
  it('opens the panel, writes what is sent in it, and closes it on Ctrl+C with code 0', async () => {
    const fake = fakePanel();
    const opened: PanelOptions[] = [];
    const opener = (options: PanelOptions): Promise<ChatPanel> => {
      opened.push(options);
      // The panel draws its footer as it opens, before the session is there.
      expect(options.footer(80)).toEqual([`  ${' '.repeat(55)}\u001b[90mCtrl+C duas vezes sai\u001b[39m`]);
      return Promise.resolve(fake.panel);
    };
    const platform = terminal();
    const code = runShell([coreShell, VERBS_ROOT], platform, [
      replace(PANEL_OPENER, opener),
      replace(PANEL_LOGO, '/assets/logo.webp'),
      replace(PANEL_VERSION, 'choliba 1.2.3'),
      replace(PANEL_ICON, ICON),
    ]);
    await new Promise((resolve) => setImmediate(resolve));

    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      title: 'choliba 1.2.3',
      hint: 'Digite uma mensagem ou / para os comandos',
      splash: {
        image: '/assets/logo.webp',
        lines: [
          '\u001b[1m\u001b[32mBem-vindo ao choliba\u001b[39m\u001b[22m',
          '',
          'Tecle Enter para começar ou Esc para sair.',
        ],
        note: 'choliba 1.2.3',
      },
      header: {
        icon: ICON,
        lines: ['\u001b[1m\u001b[32mcholiba 1.2.3\u001b[39m\u001b[22m', '\u001b[90m~/loja\u001b[39m'],
      },
    });
    expect(opened[0]?.footer(80)).toEqual([`  ${' '.repeat(55)}\u001b[90mCtrl+C duas vezes sai\u001b[39m`]);
    fake.send('ola');
    expect(fake.said).toEqual(['ola']);
    expect(fake.written).toEqual([]);
    expect(fake.closed()).toBe(false);

    fake.interrupt();
    expect(await code).toBe(0);
    expect(fake.closed()).toBe(true);
    expect(platform.stderr.text()).toBe('');
  });

  it('stops what runs on Ctrl+C, the panel open, and /clear stops it and forgets the context and the chat', async () => {
    const fake = fakePanel();
    let stopped = 0;
    const runner: ShellModule = {
      name: 'runner',
      commands: [],
      panel: [
        {
          name: 'start',
          description: 'Começa',
          run: ({ context }) => {
            context.set('agente', 'echo');
            // Asked to stop, the work ends and says so, as a run does.
            context.busy(() => {
              stopped += 1;
              context.busy(undefined);
            });
            return Promise.resolve();
          },
        },
        {
          name: 'agente',
          description: 'Diz o agente',
          run: ({ panel, context }) => {
            panel.write(context.get('agente') ?? 'nenhum');
            return Promise.resolve();
          },
        },
      ],
    };
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    const code = runShell([coreShell, runner, VERBS_ROOT], terminal(), [
      replace(PANEL_OPENER, () => Promise.resolve(fake.panel)),
    ]);
    await settle();
    fake.send('/start');
    await settle();
    fake.interrupt();
    expect([stopped, fake.closed()]).toEqual([1, false]);

    fake.send('/start');
    await settle();
    fake.send('/clear');
    await settle();
    fake.send('/agente');
    await settle();
    expect(stopped).toBe(2);
    expect(fake.written).toEqual(['nenhum']);
    expect(fake.said).toEqual(['/agente']);

    fake.interrupt();
    expect(await code).toBe(0);
    expect(fake.closed()).toBe(true);
  });

  it('puts what the commands give on the left of the footer and how to leave on the right, or after it when narrow', async () => {
    const opened: PanelOptions[] = [];
    const fake = fakePanel();
    const moder: ShellModule = {
      name: 'moder',
      commands: [],
      panel: [
        {
          name: 'modo',
          description: 'Põe o modo',
          run: ({ context }) => {
            context.status('modo', 'plan');
            return Promise.resolve();
          },
        },
      ],
    };
    const settle = () => new Promise((resolve) => setImmediate(resolve));
    const code = runShell([coreShell, moder, VERBS_ROOT], terminal(), [
      replace(PANEL_OPENER, (options: PanelOptions) => {
        opened.push(options);
        return Promise.resolve(fake.panel);
      }),
    ]);
    await settle();
    fake.send('/modo');
    await settle();

    const leave = '\u001b[90mCtrl+C duas vezes sai\u001b[39m';
    expect(opened[0]?.footer(40)).toEqual([`  plan${' '.repeat(11)}${leave}`]);
    expect(opened[0]?.footer(30)).toEqual([`  plan\u001b[90m · \u001b[39m${leave}`]);
    fake.interrupt();
    expect(await code).toBe(0);
  });

  it('welcomes with no image when the app gives none', async () => {
    const fake = fakePanel();
    const opened: PanelOptions[] = [];
    const code = runShell([coreShell, VERBS_ROOT], terminal(), [
      replace(PANEL_OPENER, (options: PanelOptions) => {
        opened.push(options);
        return Promise.resolve(fake.panel);
      }),
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    fake.interrupt();

    expect(await code).toBe(0);
    expect(opened[0]?.splash).not.toHaveProperty('image');
    expect(opened[0]?.splash).not.toHaveProperty('note');
    expect(opened[0]?.title).toBe('choliba');
    expect(opened[0]?.header).toEqual({
      lines: ['\u001b[1m\u001b[32mcholiba\u001b[39m\u001b[22m', '\u001b[90m~/loja\u001b[39m'],
    });
  });

  it('shows the folder as it is outside the home folder, or with no home', async () => {
    for (const [cwd, home] of [
      ['/srv/loja', '/home/ana'],
      ['/home/ana', '/home/ana'],
      ['/home/anabela', '/home/ana'],
      ['/srv/loja', undefined],
    ] as const) {
      const fake = fakePanel();
      const opened: PanelOptions[] = [];
      const platform = fakePlatform({
        argv: ['panel'],
        cwd,
        env: home === undefined ? {} : { HOME: home },
        stdout: new BufferWritable(true),
      });
      const code = runShell([coreShell, VERBS_ROOT], platform, [
        replace(PANEL_OPENER, (options: PanelOptions) => {
          opened.push(options);
          return Promise.resolve(fake.panel);
        }),
      ]);
      await new Promise((resolve) => setImmediate(resolve));
      fake.interrupt();
      await code;
      const shown = { '/srv/loja': '/srv/loja', '/home/ana': '~', '/home/anabela': '/home/anabela' }[cwd];
      expect(opened[0]?.header?.lines[1]).toBe(`\u001b[90m${shown}\u001b[39m`);
    }
  });

  it('fails out of a terminal, without opening anything', async () => {
    const opened: PanelOptions[] = [];
    const platform = fakePlatform({ argv: ['panel'] });

    expect(
      await runShell([coreShell, VERBS_ROOT], platform, [
        replace(PANEL_OPENER, (options: PanelOptions) => {
          opened.push(options);
          return Promise.resolve(undefined);
        }),
      ]),
    ).toBe(1);
    expect(opened).toEqual([]);
    expect(platform.stderr.text()).toBe('erro: o painel precisa de um terminal interativo.\n');
  });

  it('fails when the panel does not open on the terminal', async () => {
    const platform = terminal();

    expect(
      await runShell([coreShell, VERBS_ROOT], platform, [replace(PANEL_OPENER, () => Promise.resolve(undefined))]),
    ).toBe(1);
    expect(platform.stderr.text()).toBe('erro: o painel precisa de um terminal interativo.\n');
  });

  it('shows its help, and refuses arguments', async () => {
    const help = terminal(['--help']);
    expect(await runShell([coreShell, VERBS_ROOT], help)).toBe(0);
    expect(help.stdout.text()).toContain('Usage:  choliba panel');
    expect(help.stdout.text()).toContain('Abre o painel:');

    const extra = terminal(['agora']);
    expect(await runShell([coreShell, VERBS_ROOT], extra)).toBe(1);
    expect(extra.stderr.text()).toContain('argumento a mais: agora.');
  });

  it('is in the root help', async () => {
    const platform = fakePlatform({ argv: ['--help'] });

    expect(await runShell([coreShell, VERBS_ROOT], platform)).toBe(0);
    expect(platform.stdout.text()).toMatch(/panel +Abre o painel interativo do choliba no terminal\./);
  });
});
