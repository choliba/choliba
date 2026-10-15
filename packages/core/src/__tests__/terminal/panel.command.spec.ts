import { coreShell, PANEL_ICON, PANEL_LOGO, PANEL_OPENER, PANEL_VERSION } from '../../shell';
import type { ChatPanel, PanelOptions } from '../../terminal';
import { BufferWritable, fakePlatform, replace, runShell, VERBS_ROOT, type FakePlatform } from '../../testing';

/** A panel that keeps what is written, and lets a spec send a message or press Ctrl+C. */
function fakePanel() {
  const written: string[] = [];
  const said: string[] = [];
  const messages: ((text: string) => void)[] = [];
  const interrupts: (() => void)[] = [];
  let closed = false;
  const panel: ChatPanel = {
    write: (text) => {
      written.push(text);
    },
    say: (text) => {
      said.push(text);
    },
    refresh: () => undefined,
    onInterrupt: (listener) => {
      interrupts.push(listener);
    },
    ask: () => Promise.resolve({ status: 'skipped' }),
    onMessage: (listener) => {
      messages.push(listener);
    },
    close: () => {
      closed = true;
    },
  };
  return {
    panel,
    written,
    said,
    send: (text: string) => {
      messages.forEach((listener) => {
        listener(text);
      });
    },
    interrupt: () => {
      interrupts.forEach((listener) => {
        listener();
      });
    },
    closed: () => closed,
  };
}

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
      hint: 'Digite uma mensagem',
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
    expect(opened[0]?.footer(80)).toEqual(['\u001b[90m  Ctrl+C duas vezes sai\u001b[39m']);
    fake.send('ola');
    expect(fake.said).toEqual(['ola']);
    expect(fake.written).toEqual([]);
    expect(fake.closed()).toBe(false);

    fake.interrupt();
    expect(await code).toBe(0);
    expect(fake.closed()).toBe(true);
    expect(platform.stderr.text()).toBe('');
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
