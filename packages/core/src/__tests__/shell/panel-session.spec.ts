import { Container, type PanelCommand, type PanelCommandContext } from '../../shell';
import { panelSession } from '../../shell/panel-session';
import { fakeChatPanel } from '../../testing';

const HEADING = ['choliba 1.2.3', '~/loja'];

/** Commands that note each run, and one that fails. */
function commands() {
  const ran: string[] = [];
  const note =
    (name: string) =>
    ({ context }: PanelCommandContext): Promise<void> => {
      ran.push(name);
      context.set(name, `${name}-1`);
      return Promise.resolve();
    };
  const list: readonly PanelCommand[] = [
    { name: 'projects', description: 'Escolhe o projeto', run: note('projects') },
    { name: 'pull', description: 'Puxa', run: note('pull') },
    { name: 'tickets', description: 'Escolhe o ticket', run: note('tickets') },
    {
      name: 'quebra',
      description: 'Falha',
      run: () => Promise.reject(new Error('sem CHOL_GLOBAL_DIR')),
    },
  ];
  return { ran, list };
}

/** A session on a fake panel, and a way to wait for what a sent line started. */
function session() {
  const fake = fakeChatPanel();
  const { ran, list } = commands();
  panelSession(new Container(), fake.panel, list, HEADING);
  return { fake, ran, settle: () => new Promise((resolve) => setImmediate(resolve)) };
}

describe('panelSession', () => {
  it('says what has no slash, and runs nothing', async () => {
    const { fake, ran, settle } = session();
    fake.send('olá');
    await settle();

    expect(fake.said).toEqual(['olá']);
    expect(ran).toEqual([]);
    expect(fake.suggested).toEqual([[]]);
  });

  it('runs the command named whole, or the first that starts with what was sent', async () => {
    const { fake, ran, settle } = session();
    fake.send('/tickets');
    await settle();
    fake.send('/p');
    await settle();
    fake.send('/');
    await settle();

    expect(ran).toEqual(['tickets', 'projects', 'projects']);
    expect(fake.said).toEqual(['/tickets', '/projects', '/projects']);
    expect(fake.choices).toEqual([]);
  });

  it('runs the highlighted command, moved with ↑ and ↓ around the list, the highlight kept for the clear before sending', async () => {
    const { fake, ran, settle } = session();
    fake.type('/p');
    expect(fake.press('down')).toBe(true);
    fake.type('');
    fake.send('/p');
    await settle();

    fake.type('/');
    fake.press('up');
    expect(fake.suggested.at(-1)?.[3]).toContain('❯ /quebra');
    fake.press('up');
    fake.press('down');
    fake.type('/');
    fake.send('/');
    await settle();

    expect(ran).toEqual(['pull']);
    expect(fake.written).toEqual(['\u001b[31merro: sem CHOL_GLOBAL_DIR\u001b[39m']);
  });

  it('hides the list with Esc, and leaves the keys to the field when there is no list or the key is not its', () => {
    const { fake } = session();
    expect(fake.press('down')).toBe(false);
    fake.type('/t');
    expect(fake.press('left')).toBe(false);
    expect(fake.press('escape')).toBe(true);

    expect(fake.suggested.at(-1)).toEqual([]);
    expect(fake.press('escape')).toBe(false);
  });

  it('says a command is unknown, naming how to see them', async () => {
    const { fake, ran, settle } = session();
    fake.send('/xyz');
    await settle();

    expect(fake.written).toEqual(['\u001b[33mComando desconhecido: /xyz. Digite / para ver os comandos.\u001b[39m']);
    expect(ran).toEqual([]);
  });

  it('writes the error of a command that fails, and goes on', async () => {
    const { fake, ran, settle } = session();
    fake.send('/quebra');
    await settle();
    fake.send('/tickets');
    await settle();

    expect(fake.written).toEqual(['\u001b[31merro: sem CHOL_GLOBAL_DIR\u001b[39m']);
    expect(ran).toEqual(['tickets']);
  });

  it('suggests the commands that start with what is typed after the slash, the first highlighted', () => {
    const { fake } = session();
    fake.type('/p');
    fake.type('olá');
    fake.type('/projects loja');

    expect(fake.suggested).toEqual([
      ['\u001b[1m❯ /projects\u001b[22m  Escolhe o projeto', '  /pull      \u001b[90mPuxa\u001b[39m'],
      [],
      [],
    ]);
  });

  it('keeps the values the commands set, and shows their cards in the header in the order first shown', async () => {
    const fake = fakeChatPanel();
    let set: PanelCommandContext['context'] | undefined;
    const session = panelSession(
      new Container(),
      fake.panel,
      [
        {
          name: 'ctx',
          description: 'Contexto',
          run: ({ context }) => {
            set = context;
            return Promise.resolve();
          },
        },
      ],
      HEADING,
    );
    fake.send('/ctx');
    await new Promise((resolve) => setImmediate(resolve));
    set?.set('projeto', 'loja');
    expect(set?.get('projeto')).toBe('loja');
    set?.set('projeto', undefined);
    expect(set?.get('projeto')).toBeUndefined();

    set?.show('projeto', { lines: ['loja'] });
    set?.show('ticket', { lines: ['loja-1'] });
    set?.show('projeto', { lines: ['site'], summary: 'site · 2', key: 'p' });
    expect(session.shortcuts()).toEqual(['Ctrl+P projeto']);
    set?.show('ticket', undefined);

    expect(fake.cards).toEqual([
      [{ title: 'projeto', lines: ['loja'] }],
      [
        { title: 'projeto', lines: ['loja'] },
        { title: 'ticket', lines: ['loja-1'] },
      ],
      [
        { title: 'projeto', lines: ['site'], summary: 'site · 2', key: 'p' },
        { title: 'ticket', lines: ['loja-1'] },
      ],
      [{ title: 'projeto', lines: ['site'], summary: 'site · 2', key: 'p' }],
    ]);
    expect(fake.headings).toEqual([]);
  });

  it('shows a command that cannot run in gray with why, skips it with the keys, and says why when sent', async () => {
    const fake = fakeChatPanel();
    const ran: string[] = [];
    let ready = false;
    const list: readonly PanelCommand[] = [
      {
        name: 'tickets',
        description: 'Escolhe o ticket',
        unavailable: () => (ready ? undefined : 'Escolha um projeto antes'),
        run: () => {
          ran.push('tickets');
          return Promise.resolve();
        },
      },
      {
        name: 'tests',
        description: 'Roda os testes',
        run: () => {
          ran.push('tests');
          return Promise.resolve();
        },
      },
    ];
    panelSession(new Container(), fake.panel, list, HEADING);
    const settle = () => new Promise((resolve) => setImmediate(resolve));

    fake.type('/t');
    expect(fake.suggested.at(-1)).toEqual([
      '\u001b[90m  /tickets  Escolha um projeto antes\u001b[39m',
      '\u001b[1m❯ /tests  \u001b[22m  Roda os testes',
    ]);
    fake.press('down');
    fake.press('up');
    expect(fake.suggested.at(-1)?.[1]).toContain('❯ /tests');
    fake.click(0);
    fake.send('/tickets');
    await settle();
    expect(fake.written).toEqual(['\u001b[33mEscolha um projeto antes\u001b[39m']);
    expect(ran).toEqual([]);

    fake.type('/tick');
    expect(fake.press('down')).toBe(true);
    expect(fake.press('tab')).toBe(true);
    expect(fake.filled).toEqual([]);
    ready = true;
    fake.send('/tickets');
    await settle();
    expect(ran).toEqual(['tickets']);
  });

  it('puts the highlighted command in the field with Tab, and runs the one clicked', async () => {
    const { fake, ran, settle } = session();
    fake.type('/p');
    fake.press('down');
    fake.press('tab');
    expect(fake.filled).toEqual(['/pull']);

    fake.type('/t');
    fake.click(0);
    await settle();
    expect(fake.filled).toEqual(['/pull', '']);
    expect(fake.said).toEqual(['/tickets']);
    expect(ran).toEqual(['tickets']);
    fake.click(5);
    expect(ran).toEqual(['tickets']);
  });

  it('answers what a command writes', async () => {
    const fake = fakeChatPanel();
    panelSession(
      new Container(),
      fake.panel,
      [
        {
          name: 'diz',
          description: 'Diz',
          run: ({ panel }) => {
            panel.write('oi');
            return Promise.resolve();
          },
        },
      ],
      HEADING,
    );
    fake.send('/diz');
    await new Promise((resolve) => setImmediate(resolve));

    expect(fake.written).toEqual(['oi']);
  });

  it('shows the labels the commands set in the header column, under its fixed lines, in the order they came', async () => {
    const fake = fakeChatPanel();
    let set: PanelCommandContext['context'] | undefined;
    panelSession(
      new Container(),
      fake.panel,
      [
        {
          name: 'ctx',
          description: 'Contexto',
          run: ({ context }) => {
            set = context;
            return Promise.resolve();
          },
        },
      ],
      HEADING,
    );
    fake.send('/ctx');
    await new Promise((resolve) => setImmediate(resolve));
    set?.label('provider', 'claude');
    set?.label('modelo', 'padrão');
    set?.label('provider', 'cursor');
    set?.label('provider', undefined);

    expect(fake.headings).toEqual([
      [...HEADING, '\u001b[90mprovider\u001b[39m claude'],
      [...HEADING, '\u001b[90mprovider\u001b[39m claude', '\u001b[90mmodelo\u001b[39m padrão'],
      [...HEADING, '\u001b[90mprovider\u001b[39m cursor', '\u001b[90mmodelo\u001b[39m padrão'],
      [...HEADING, '\u001b[90mmodelo\u001b[39m padrão'],
    ]);
  });
});
