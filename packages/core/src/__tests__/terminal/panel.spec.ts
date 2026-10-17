import type {
  PanelFieldEvent,
  PanelKey,
  PanelRendererConfig,
  PanelSelection,
  PanelToolkit,
} from '../../terminal/panel/interfaces/panel.interface';
import { loadPanelToolkit, openOpenTuiPanel, openPanelWith } from '../../terminal/panel/panel-toolkit';
import { openPanel } from '../../terminal/panel/panel';

interface FakeChunk {
  readonly text: string;
  readonly fg?: string;
  readonly bg?: string;
  readonly bold?: boolean;
}

interface FakeStyled {
  readonly chunks: FakeChunk[];
}

/** A renderable of the fake toolkit: what it was built with, and what was added to it. */
class FakeNode {
  readonly children: FakeNode[] = [];
  content: FakeStyled | string = '';
  height: number | 'auto' | `${number}%` = 'auto';
  readonly scrolls: string[] = [];
  scrollHeight = 40;
  value = '';
  placeholder: FakeStyled | string | null = '';
  onSubmit: ((event: PanelFieldEvent) => void) | undefined;
  onContentChange: ((event: PanelFieldEvent) => void) | undefined;
  visible = true;
  focused = 0;
  selectedIndex = 0;
  virtualLineCountOverride: number | undefined;
  options: { name: string; description: string }[] = [];
  onMouseDown: (() => void) | undefined;
  title: string | undefined;
  private readonly listeners = new Map<string, (() => void)[]>();

  constructor(
    readonly kind: string,
    readonly built: Readonly<Record<string, unknown>>,
  ) {
    const placeholder = built['placeholder'];
    if (typeof placeholder === 'string') this.placeholder = placeholder;
    if (built['visible'] === false) this.visible = false;
    const height = built['height'];
    if (typeof height === 'number' || height === 'auto' || (typeof height === 'string' && height.endsWith('%'))) {
      this.height = height as number | 'auto' | `${number}%`;
    }
    const content = built['content'];
    if (typeof content === 'string' || (typeof content === 'object' && content !== null)) {
      this.content = content as FakeStyled | string;
    }
  }

  add(child: FakeNode): number {
    this.children.push(child);
    return this.children.length;
  }

  remove(child: FakeNode): void {
    this.children.splice(this.children.indexOf(child), 1);
  }

  scrollBy(delta: number, unit?: 'viewport'): void {
    this.scrolls.push(`by ${String(delta)} ${unit ?? ''}`.trim());
  }

  scrollTo(position: number): void {
    this.scrolls.push(`to ${String(position)}`);
  }

  focus(): void {
    this.focused += 1;
  }

  blur(): void {
    this.focused = 0;
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  setSelectedIndex(index: number): void {
    this.selectedIndex = index;
  }

  get plainText(): string {
    return this.value;
  }

  get virtualLineCount(): number {
    return this.virtualLineCountOverride ?? this.value.split('\n').length;
  }

  setText(text: string): void {
    this.value = text;
    this.onContentChange?.({});
  }

  /** How many times the cursor was put after the last character. */
  atEnd = 0;

  gotoBufferEnd(): void {
    this.atEnd += 1;
  }

  on(event: string, listener: () => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  emit(event: string): void {
    if (event === 'submit') this.onSubmit?.({});
    (this.listeners.get(event) ?? []).forEach((listener) => {
      listener();
    });
  }
}

/** Three by two pixels: red over blue, nothing over green, nothing over nothing. */
const PIXELS = {
  data: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255, 0, 0, 0, 0]),
  width: 3,
  height: 2,
  stride: 12,
};

function fakeToolkit(failToOpen = false) {
  const images: { source: string; resized?: object; disposed: number }[] = [];
  const keys: ((key: PanelKey) => void)[] = [];
  const configs: PanelRendererConfig[] = [];
  const selections: ((selection: PanelSelection | null) => void)[] = [];
  const copied: string[] = [];
  const renderer = {
    root: new FakeNode('root', {}),
    width: 60,
    destroyed: false,
    keyInput: {
      on: (_event: 'keypress', listener: (key: PanelKey) => void) => {
        keys.push(listener);
      },
    },
    on: (_event: 'selection', listener: (selection: PanelSelection | null) => void) => {
      selections.push(listener);
    },
    copyToClipboardOSC52: (text: string) => {
      copied.push(text);
      return true;
    },
    destroy(): void {
      this.destroyed = true;
    },
  };
  type Renderer = typeof renderer;
  const kit: PanelToolkit<Renderer, FakeNode, FakeStyled, FakeChunk> = {
    createCliRenderer: (config) => {
      configs.push(config);
      return failToOpen ? Promise.reject(new Error('no terminal')) : Promise.resolve(renderer);
    },
    BoxRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('box', options as Record<string, unknown>);
      }
    },
    ScrollBoxRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('scroll', options as Record<string, unknown>);
      }
    },
    TextRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('text', options as Record<string, unknown>);
      }
    },
    TextareaRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('textarea', options as Record<string, unknown>);
      }
    },
    SelectRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('select', options as Record<string, unknown>);
      }
    },
    NativeImage: {
      load: (source) => {
        if (source === '/missing.png') return Promise.reject(new Error('no file'));
        const loaded: { source: string; resized?: object; disposed: number } = { source, disposed: 0 };
        images.push(loaded);
        const image = {
          width: 146,
          height: 180,
          resize: (options: object) => {
            loaded.resized = options;
            return image;
          },
          raw: () => PIXELS,
          dispose: () => {
            loaded.disposed += 1;
          },
        };
        return Promise.resolve(image);
      },
    },
    StyledText: class {
      constructor(readonly chunks: FakeChunk[]) {}
    },
    stringToStyledText: (content) => ({ chunks: [{ text: content }] }),
    fg: (color) => (input) => ({ text: input, fg: color }),
    bg: (color) => (input) => ({ ...input, bg: color }),
    bold: (input) => ({ ...input, bold: true }),
  };
  const press = (key: PanelKey): void => {
    keys.forEach((listener) => {
      listener(key);
    });
  };
  const select = (text: string | null): void => {
    selections.forEach((listener) => {
      listener(text === null ? null : { getSelectedText: () => text });
    });
  };
  return { kit, renderer, configs, press, images, select, copied };
}

const OPTIONS = {
  title: 'test-writer',
  titleColor: 'cyan' as const,
  footer: (width: number) => [`\u001b[1mprovider\u001b[22m largura ${String(width)}`],
  hint: 'Enter envia · Ctrl+J cria uma linha',
};

function layoutOf(renderer: ReturnType<typeof fakeToolkit>['renderer']) {
  const [layout] = renderer.root.children;
  const [scroll, select, bottom] = layout?.children ?? [];
  const [prompt, input, footer] = bottom?.children ?? [];
  if (scroll === undefined || select === undefined || bottom === undefined) throw new Error('no layout');
  if (prompt === undefined || input === undefined || footer === undefined) throw new Error('no footer row');
  return { scroll, select, bottom, prompt, input, footer };
}

describe('openPanel', () => {
  it('opens on the alternate screen, keeping Ctrl+C, with the agent as the title and the footer under the lines', async () => {
    const { kit, renderer, configs } = fakeToolkit();
    await openPanel(kit, OPTIONS);

    expect(configs).toEqual([
      { screenMode: 'alternate-screen', exitOnCtrlC: false, useMouse: true, autoFocus: false, targetFps: 30 },
    ]);
    const { scroll, footer } = layoutOf(renderer);
    expect(scroll.built).toMatchObject({ title: ' test-writer ', titleColor: '#11a8cd', stickyScroll: true });
    expect(footer.content).toEqual({ chunks: [{ text: 'provider', bold: true }, { text: ' largura 60' }] });
    expect(footer.height).toBe(1);
  });

  it('welcomes in the center with no box nor field, the image in half blocks over the lines, until Enter', async () => {
    const { kit, renderer, press, images } = fakeToolkit();
    await openPanel(kit, {
      ...OPTIONS,
      splash: {
        image: '/assets/logo.png',
        lines: ['\u001b[1mBem-vindo\u001b[22m', '', 'Tecle Enter.'],
        note: 'choliba 1.2.3',
      },
    });

    const [layout] = renderer.root.children;
    const [scroll, select, bottom, , , splash] = layout?.children ?? [];
    const input = bottom?.children[1];
    expect([scroll?.kind, select?.kind, bottom?.kind, splash?.kind]).toEqual(['scroll', 'select', 'box', 'box']);
    expect(splash?.built).toMatchObject({
      flexDirection: 'column',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    });
    expect(images).toEqual([
      { source: '/assets/logo.png', resized: { width: 24, height: 30, kernel: 'area' }, disposed: 2 },
    ]);
    const [picture, welcome, blank, hint, note] = splash?.children ?? [];
    expect(picture?.built).toMatchObject({ flexDirection: 'column', position: 'relative', top: -3 });
    expect(picture?.children.map((row) => row.content)).toEqual([
      {
        chunks: [{ text: '▀', fg: '#ff0000', bg: '#0000ff' }, { text: '▄', fg: '#00ff00' }, { text: ' ' }],
      },
    ]);
    expect(welcome?.content).toEqual({ chunks: [{ text: 'Bem-vindo', bold: true }] });
    expect([welcome?.height, blank?.height]).toEqual(['auto', 1]);
    expect(hint?.content).toEqual({ chunks: [{ text: 'Tecle Enter.' }] });
    expect(note?.content).toEqual({ chunks: [{ text: 'choliba 1.2.3', fg: '#e5e5e5' }] });
    expect(note?.built).toMatchObject({ position: 'absolute', bottom: 0, right: 1 });
    expect([splash?.visible, scroll?.visible, bottom?.visible, input?.focused]).toEqual([true, false, false, 0]);

    press({ name: 'a', ctrl: false });
    expect(splash?.visible).toBe(true);
    press({ name: 'return', ctrl: false });
    expect([splash?.visible, scroll?.visible, bottom?.visible, input?.focused]).toEqual([false, true, true, 1]);
    press({ name: 'return', ctrl: false });
    expect(input?.focused).toBe(1);
  });

  it('welcomes with the lines alone when the image does not load or there is none', async () => {
    for (const image of ['/missing.png', undefined]) {
      const { kit, renderer } = fakeToolkit();
      await openPanel(kit, { ...OPTIONS, splash: { ...(image === undefined ? {} : { image }), lines: ['Oi'] } });

      expect(renderer.root.children[0]?.children[5]?.children.map((child) => child.kind)).toEqual(['text']);
    }
  });

  it('leaves with Esc on the welcome at once, and leaves Esc to the questions after it', async () => {
    const { kit, press } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, splash: { lines: ['Oi'] } });
    let interrupted = 0;
    panel.onInterrupt(() => {
      interrupted += 1;
    });

    press({ name: 'escape', ctrl: false });
    expect(interrupted).toBe(1);
    press({ name: 'return', ctrl: false });
    press({ name: 'escape', ctrl: false });
    expect(interrupted).toBe(1);
  });

  it('closes the welcome when a line is written first, and with Enter of the keypad', async () => {
    const written = fakeToolkit();
    const panel = await openPanel(written.kit, { ...OPTIONS, splash: { lines: ['Oi'] } });
    panel.write('ola\n');
    panel.write('de novo\n');
    const [layout] = written.renderer.root.children;
    expect([layout?.children[5]?.visible, layout?.children[2]?.visible]).toEqual([false, true]);

    const keypad = fakeToolkit();
    await openPanel(keypad.kit, { ...OPTIONS, splash: { lines: ['Oi'] } });
    keypad.press({ name: 'kpenter', ctrl: false });
    expect(keypad.renderer.root.children[0]?.children[5]?.visible).toBe(false);
  });

  it('draws a header with its icon over the lines, which take the width with no border, the footer under the field', async () => {
    const { kit, renderer } = fakeToolkit();
    await openPanel(kit, {
      ...OPTIONS,
      header: { icon: PIXELS, lines: ['\u001b[1mcholiba 1.2.3\u001b[22m', '~/loja'] },
    });

    const [layout] = renderer.root.children;
    const [header, scroll, select, bottom, suggestions, picker, footer] = layout?.children ?? [];
    expect([
      header?.kind,
      scroll?.kind,
      select?.kind,
      bottom?.kind,
      suggestions?.kind,
      picker?.kind,
      footer?.kind,
    ]).toEqual(['box', 'scroll', 'select', 'box', 'box', 'box', 'text']);
    expect(header?.built).toMatchObject({ flexDirection: 'row', gap: 2, paddingLeft: 1, paddingBottom: 1 });
    const [icon, lines] = header?.children ?? [];
    expect(icon?.built).toMatchObject({ position: 'relative', top: -0 });
    expect(icon?.children).toHaveLength(1);
    expect(lines?.children.map((line) => line.content)).toEqual([
      { chunks: [{ text: 'choliba 1.2.3', bold: true }] },
      { chunks: [{ text: '~/loja' }] },
    ]);
    expect(scroll?.built).toMatchObject({ border: false, title: '' });
    expect(bottom?.children.map((child) => child.kind)).toEqual(['text', 'textarea']);
    expect(footer?.content).toEqual({ chunks: [{ text: 'provider', bold: true }, { text: ' largura 60' }] });
    expect(bottom?.height).toBe(3);
  });

  it('draws a header of lines alone when it has no icon, hidden with the field while the welcome shows', async () => {
    const { kit, renderer, press } = fakeToolkit();
    await openPanel(kit, { ...OPTIONS, header: { lines: ['oi'] }, splash: { lines: ['Bem-vindo'] } });

    const [layout] = renderer.root.children;
    const [header, , , bottom, , , footer] = layout?.children ?? [];
    expect(header?.children.map((child) => child.kind)).toEqual(['box']);
    expect([header?.visible, bottom?.visible, footer?.visible]).toEqual([false, false, false]);
    press({ name: 'return', ctrl: false });
    expect([header?.visible, bottom?.visible, footer?.visible]).toEqual([true, true, true]);
  });

  it('empties the conversation on clear, and writes after it again', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    panel.write('linha\noutra');
    panel.say('olá');
    panel.answer('oi');
    const [scroll] = renderer.root.children[0]?.children ?? [];
    expect(scroll?.children).toHaveLength(4);

    panel.clear();
    expect(scroll?.children).toEqual([]);
    panel.answer('de novo');
    panel.clear();
    expect(scroll?.children).toEqual([]);
  });

  it('answers after a blank row, ● beside the lines, which wrap beside it', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, splash: { lines: ['Oi'] } });
    panel.answer('Projeto ativo: \u001b[1msite\u001b[22m.\nsegunda\n');
    panel.answer('uma');

    const [scroll, , , , , splash] = renderer.root.children[0]?.children ?? [];
    const [reply, other] = scroll?.children ?? [];
    expect(splash?.visible).toBe(false);
    expect(reply?.built).toMatchObject({ flexDirection: 'row', marginTop: 1, paddingLeft: 1 });
    const [bullet, text] = reply?.children ?? [];
    expect(bullet?.built).toMatchObject({ content: '● ', flexShrink: 0 });
    expect(text?.built).toMatchObject({ flexGrow: 1 });
    expect(text?.content).toEqual({
      chunks: [
        { text: 'Projeto ativo: ' },
        { text: 'site', bold: true },
        { text: '.' },
        { text: '\n' },
        { text: 'segunda' },
      ],
    });
    expect(other?.children[1]?.content).toEqual({ chunks: [{ text: 'uma' }] });
  });

  it('marks what the person said on a band of its own, after a blank row', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, splash: { lines: ['Oi'] } });
    panel.say('olá');

    const [layout] = renderer.root.children;
    const [scroll, , , , , splash] = layout?.children ?? [];
    const [band] = scroll?.children ?? [];
    expect(splash?.visible).toBe(false);
    expect(band?.built).toMatchObject({
      flexDirection: 'row',
      marginTop: 1,
      paddingLeft: 1,
      backgroundColor: '#373737',
    });
    expect(band?.children[0]?.content).toEqual({ chunks: [{ text: '❯ olá' }] });
  });

  it('chooses in place of the field, ❯ on the highlight and ✔ on the current option, the keys moving it', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const [layout] = renderer.root.children;
    const [, , bottom, suggestions, picker] = layout?.children ?? [];
    const [title, description, , ...rest] = picker?.children ?? [];
    const options = rest.slice(0, 8);
    const hints = rest.at(-1);
    const input = bottom?.children[1];
    panel.suggest(['  /projects']);

    const chosen = panel.choose({
      title: 'Escolha o projeto',
      description: 'Onde agir.',
      options: [{ label: 'loja', detail: 'Loja de exemplo' }, { label: 'blog-novo', current: true }, { label: 'c' }],
    });
    expect(picker?.built).toMatchObject({
      flexDirection: 'column',
      border: ['top', 'bottom'],
      paddingLeft: 1,
      flexShrink: 0,
    });
    expect([picker?.visible, bottom?.visible, suggestions?.visible, input?.focused]).toEqual([true, false, false, 0]);
    expect(title?.content).toEqual({ chunks: [{ text: 'Escolha o projeto', bold: true }] });
    expect(description?.content).toEqual({ chunks: [{ text: 'Onde agir.', fg: '#666666' }] });
    expect(hints?.content).toEqual({
      chunks: [{ text: '↑↓ ou Tab move · Enter escolhe · clique escolhe · Esc cancela', fg: '#666666' }],
    });
    const texts = (): string[] =>
      options
        .filter((row) => row.visible)
        .map((row) =>
          typeof row.content === 'string' ? row.content : row.content.chunks.map((chunk) => chunk.text).join(''),
        );
    expect(texts()).toEqual(['  1. loja         Loja de exemplo', '❯ 2. blog-novo ✔', '  3. c          ']);
    expect(picker?.height).toBe(10);

    press({ name: 'down', ctrl: false });
    expect(texts()[2]).toBe('❯ 3. c          ');
    press({ name: 'tab', ctrl: false });
    expect(texts()[0]).toBe('❯ 1. loja         Loja de exemplo');
    press({ name: 'up', ctrl: false });
    press({ name: '2', ctrl: false });
    press({ name: '9', ctrl: false });
    press({ name: 'a', ctrl: false });
    expect(texts()[1]).toBe('❯ 2. blog-novo ✔');
    press({ name: 'return', ctrl: false });
    expect(await chosen).toBe(1);
    expect([picker?.visible, bottom?.visible]).toEqual([false, true]);
    expect(input?.focused).toBeGreaterThan(0);
  });

  it('picks the option clicked, and none past the list or when no choice is open', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const picker = renderer.root.children[0]?.children[4];
    const rows = picker?.children.slice(3, 11) ?? [];

    const chosen = panel.choose({ title: 'T', description: 'D', options: [{ label: 'a' }, { label: 'b' }] });
    rows[5]?.onMouseDown?.();
    rows[1]?.onMouseDown?.();
    expect(await chosen).toBe(1);
    rows[0]?.onMouseDown?.();
  });

  it('wraps a long detail under itself in the width of the panel, and follows the highlight through a long list', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const picker = renderer.root.children[0]?.children[4];
    const rows = picker?.children.slice(3, 11) ?? [];
    const text = (row: (typeof rows)[number] | undefined): string =>
      row === undefined || typeof row.content === 'string'
        ? ''
        : row.content.chunks.map((chunk) => chunk.text).join('');

    void panel.choose({
      title: 'T',
      description: 'D',
      options: [
        { label: 'site', detail: 'Uma página só, para experimentar o choliba: um formulário de newsletter.' },
        ...Array.from({ length: 10 }, (_, index) => ({ label: `p${String(index)}` })),
      ],
    });
    expect(text(rows[0])).toBe(
      '❯ 1. site    Uma página só, para experimentar o choliba: um\n             formulário de newsletter.',
    );
    expect([rows[0]?.height, rows[1]?.height, picker?.height]).toEqual([2, 1, 16]);

    for (let step = 0; step < 9; step += 1) press({ name: 'down', ctrl: false });
    expect(text(rows[7])).toBe('❯ 10. p8    ');
    expect(text(rows[0])).toBe('  3. p1    ');
    press({ name: 'escape', ctrl: false });
  });

  it('gives nothing when the choice is left with Esc, and leaves the keys alone when none is open', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const chosen = panel.choose({ title: 'T', description: 'D', options: [] });
    press({ name: 'return', ctrl: false });
    press({ name: 'escape', ctrl: false });

    expect(await chosen).toBeUndefined();
    expect(renderer.root.children[0]?.children[4]?.visible).toBe(false);
    press({ name: 'escape', ctrl: false });
    press({ name: '1', ctrl: false });
  });

  it('gives the keys to its key listeners first, the ones they take kept from the panel', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const seen: string[] = [];
    panel.onKey((key) => {
      seen.push(key.name);
      return key.name === 'pageup';
    });
    const [scroll] = renderer.root.children[0]?.children ?? [];

    press({ name: 'pageup', ctrl: false });
    press({ name: 'pagedown', ctrl: false });

    expect(seen).toEqual(['pageup', 'pagedown']);
    expect(scroll?.scrolls).toEqual(['by 1 viewport']);
  });

  it('shows suggestions under the field, a row each that gives its index when clicked, and puts text in the field', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const typed: string[] = [];
    panel.onTyping((text) => typed.push(text));
    const [layout] = renderer.root.children;
    const [, , bottom, suggestions] = layout?.children ?? [];
    const rows = suggestions?.children ?? [];
    const clicked: number[] = [];

    panel.fill('/p');
    expect([typed, bottom?.children[1]?.plainText]).toEqual([['/p'], '/p']);
    panel.suggest(['  /projects', '  /pull'], (index) => clicked.push(index));
    expect([suggestions?.visible, suggestions?.height, rows.length]).toEqual([true, 2, 10]);
    expect(rows.map((row) => row.visible).slice(0, 3)).toEqual([true, true, false]);
    expect(rows[1]?.content).toEqual({ chunks: [{ text: '  /pull' }] });
    rows[1]?.onMouseDown?.();
    expect(clicked).toEqual([1]);

    panel.suggest([]);
    expect([suggestions?.visible, suggestions?.height]).toEqual([false, 0]);
    rows[0]?.onMouseDown?.();
    expect(clicked).toEqual([1]);
  });

  it('shows cards on the right of the header lines, all as tall and scrolling inside, each made once', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, header: { lines: ['a'] } });
    const header = renderer.root.children[0]?.children[0];

    panel.cards([
      { title: 'projeto', lines: ['site', '', 'Loja', 'local', '---', '2 tickets', 'a mais'], summary: 'site · 2' },
      { title: 'ticket', lines: ['site-1'] },
    ]);
    const [, projeto, ticket] = header?.children ?? [];
    expect(projeto?.kind).toBe('scroll');
    expect(projeto?.built).toMatchObject({
      flexGrow: 0,
      border: true,
      title: ' projeto ',
      titleColor: '#e5e5e5',
      stickyScroll: false,
      scrollX: false,
      width: 44,
      paddingLeft: 1,
      paddingRight: 1,
      flexShrink: 0,
    });
    expect([projeto?.title, projeto?.height, ticket?.height]).toEqual([' ▾ projeto ', 10, 10]);
    expect(projeto?.children.map((row) => row.content)).toEqual([
      { chunks: [{ text: 'site' }] },
      { chunks: [] },
      { chunks: [{ text: 'Loja' }] },
      { chunks: [{ text: 'local' }] },
      { chunks: [{ text: '─'.repeat(39), fg: '#666666' }] },
      { chunks: [{ text: '2 tickets' }] },
      { chunks: [{ text: 'a mais' }] },
    ]);
    expect(projeto?.children[0]?.built).toMatchObject({ wrapMode: 'word', height: 1 });
    expect(ticket?.children.map((row) => row.visible)).toEqual([true]);

    panel.cards([{ title: 'ticket', lines: ['site-2'] }]);
    expect([projeto?.visible, ticket?.visible, header?.children.length]).toEqual([false, true, 3]);
    expect(ticket?.children[0]?.content).toEqual({ chunks: [{ text: 'site-2' }] });

    panel.cards([
      { title: 'ticket', lines: ['site-2'] },
      { title: 'projeto', lines: ['site'] },
    ]);
    expect(header?.children.slice(1).map((card) => card.title)).toEqual([' ▾ ticket ', ' ▾ projeto ']);
    expect(projeto?.children.map((row) => row.visible)).toEqual([true, false, false, false, false, false, false]);

    const plain = fakeToolkit();
    const bare = await openPanel(plain.kit, OPTIONS);
    bare.cards([{ title: 'projeto', lines: ['x'] }]);
  });

  it('wraps a long card line between words, its row as tall as it takes', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, header: { lines: ['a'] } });
    panel.cards([
      {
        title: 'projeto',
        lines: [
          'site',
          '\u001b[90mLoja de exemplo: Uma página só, para experimentar o choliba: um formulário.\u001b[39m',
        ],
      },
    ]);
    const projeto = renderer.root.children[0]?.children[0]?.children[1];

    expect(projeto?.children.slice(0, 2).map((row) => row.height)).toEqual([1, 2]);
    expect(projeto?.height).toBe(10);
  });

  it("turns a spinner in a busy card's title, only while one is busy, and stops it on close", async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, header: { lines: ['a'] } });
    jest.useFakeTimers();
    try {
      panel.cards([
        { title: 'projeto', lines: ['site'] },
        { title: 'agente', lines: ['echo'], busy: true },
      ]);
      const [, projeto, agente] = renderer.root.children[0]?.children[0]?.children ?? [];
      expect([projeto?.title, agente?.title]).toEqual([' ▾ projeto ', ' ▾ agente ⠋ ']);
      jest.advanceTimersByTime(160);
      expect(agente?.title).toBe(' ▾ agente ⠹ ');

      panel.cards([{ title: 'agente', lines: ['echo'] }]);
      expect([agente?.title, jest.getTimerCount()]).toEqual([' ▾ agente ', 0]);

      panel.cards([{ title: 'agente', lines: ['echo'], busy: true }]);
      panel.cards([{ title: 'agente', lines: ['echo'], busy: true }]);
      expect(jest.getTimerCount()).toBe(1);
      panel.close();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('collapses a card to its summary with Ctrl and its key or a click on it, and opens it again', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, header: { lines: ['a'] } });
    panel.cards([
      { title: 'projeto', lines: ['site', '', 'Loja'], summary: 'site · 2', key: 'p' },
      { title: 'agente', lines: ['echo', 'x'], key: 'a' },
    ]);
    const [, projeto, agente] = renderer.root.children[0]?.children[0]?.children ?? [];

    press({ name: 'p', ctrl: true });
    expect([projeto?.title, projeto?.height, agente?.title, agente?.height]).toEqual([
      ' ▸ projeto ',
      3,
      ' ▾ agente ',
      10,
    ]);
    expect(projeto?.children[0]?.content).toEqual({ chunks: [{ text: 'site · 2' }] });
    press({ name: 'a', ctrl: true });
    expect(agente?.children[0]?.content).toEqual({ chunks: [{ text: 'echo' }] });
    expect(agente?.title).toBe(' ▸ agente ');

    projeto?.onMouseDown?.();
    expect([projeto?.title, projeto?.height, agente?.title]).toEqual([' ▾ projeto ', 10, ' ▸ agente ']);
    press({ name: 'p', ctrl: false });
    press({ name: 'x', ctrl: true });
    expect([projeto?.title, agente?.title]).toEqual([' ▾ projeto ', ' ▸ agente ']);
    panel.cards([{ title: 'agente', lines: [], key: 'a' }]);
    expect(agente?.children[0]?.content).toEqual({ chunks: [] });

    const plain = fakeToolkit();
    await openPanel(plain.kit, OPTIONS);
    plain.press({ name: 'p', ctrl: true });
  });

  it('replaces the header lines, a line no longer given kept empty, and ignores it with no header', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, { ...OPTIONS, header: { lines: ['a', 'b'] } });
    const column = renderer.root.children[0]?.children[0]?.children[0];

    panel.heading(['a', 'b', 'c']);
    expect(column?.children.map((row) => row.content)).toEqual([
      { chunks: [{ text: 'a' }] },
      { chunks: [{ text: 'b' }] },
      { chunks: [{ text: 'c' }] },
    ]);
    panel.heading(['x']);
    expect(column?.children.map((row) => row.content)).toEqual([{ chunks: [{ text: 'x' }] }, '', '']);

    const plain = fakeToolkit();
    const bare = await openPanel(plain.kit, OPTIONS);
    bare.heading(['nada']);
  });

  it('puts the field on the left of the footer, focused, with the hint, and the list hidden', async () => {
    const { kit, renderer } = fakeToolkit();
    await openPanel(kit, OPTIONS);

    const { select, bottom, prompt, input } = layoutOf(renderer);
    expect(bottom.built).toMatchObject({ flexDirection: 'row', border: ['top', 'bottom'] });
    expect(bottom.height).toBe(3);
    expect(prompt.content).toBe('❯ ');
    expect(input.built).toMatchObject({ flexGrow: 1 });
    expect(input.placeholder).toBe('Enter envia · Ctrl+J cria uma linha');
    expect(input.focused).toBe(1);
    expect(select.visible).toBe(false);
  });

  it('sends with Enter, adds a line with Shift+Enter, and grows up to five lines', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { input, bottom } = layoutOf(renderer);
    const sent: string[] = [];
    panel.onMessage((text) => sent.push(text));

    expect(input.kind).toBe('textarea');
    expect(input.built['keyBindings']).toEqual([
      { name: 'return', action: 'submit' },
      { name: 'return', shift: true, action: 'newline' },
      { name: 'kpenter', action: 'submit' },
      { name: 'kpenter', shift: true, action: 'newline' },
      { name: 'linefeed', action: 'newline' },
      { name: 'linefeed', shift: true, action: 'newline' },
    ]);

    input.virtualLineCountOverride = 1;
    input.setText('uma\nduas');
    expect(input.height).toBe(2);
    expect(bottom.height).toBe(4);
    input.virtualLineCountOverride = undefined;
    input.setText('uma\nduas\ntrês\nquatro\ncinco\nseis');
    expect(input.height).toBe(5);
    expect(bottom.height).toBe(7);
    input.emit('submit');

    expect(sent).toEqual(['uma\nduas\ntrês\nquatro\ncinco\nseis']);
    expect(input.plainText).toBe('');
    expect(input.height).toBe(1);
    expect(bottom.height).toBe(3);
  });

  it('asks in the field and takes the answer in words, then sends what is typed with no question', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { input } = layoutOf(renderer);
    const sent: string[] = [];
    panel.onMessage((text) => sent.push(text));

    const reply = panel.ask({ question: 'Qual o nome?', options: [], multi: false });
    expect(input.placeholder).toBe('Qual o nome?');
    input.emit('submit');
    input.value = ' Jackson ';
    input.emit('submit');
    expect(await reply).toEqual({ status: 'answered', answer: 'Jackson' });

    expect(input.placeholder).toBe('Enter envia · Ctrl+J cria uma linha');
    input.value = 'continue com React';
    input.emit('submit');
    expect(sent).toEqual(['continue com React']);
    expect(input.value).toBe('');
  });

  it('brings back what was sent with ↑ and ↓, on an empty field, keeping the keys from it', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { input } = layoutOf(renderer);
    const taken: string[] = [];
    panel.onKey((key) => {
      taken.push(key.name);
      return false;
    });
    let prevented = 0;
    const key = (name: string): void => {
      press({
        name,
        ctrl: false,
        preventDefault: () => {
          prevented += 1;
        },
      });
    };
    for (const text of ['primeira', '/sandbox']) {
      input.value = text;
      input.emit('submit');
    }

    key('up');
    expect([input.plainText, input.atEnd]).toEqual(['/sandbox', 1]);
    key('up');
    key('up');
    expect(input.plainText).toBe('primeira');
    key('down');
    expect(input.plainText).toBe('/sandbox');
    key('down');
    expect(input.plainText).toBe('');
    expect([prevented, taken]).toEqual([5, []]);

    key('down');
    input.setText('digitado');
    key('up');
    expect([input.plainText, prevented, taken]).toEqual(['digitado', 5, ['down', 'up']]);
  });

  it('leaves ↑ and ↓ to a question waiting for its answer', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { input } = layoutOf(renderer);
    input.value = 'enviada';
    input.emit('submit');

    void panel.ask({ question: 'Framework?', options: ['React', 'Vue'], multi: false });
    press({ name: 'up', ctrl: false });
    expect(input.plainText).toBe('');
  });

  it('copies what is dragged over with the mouse to the clipboard, and nothing for an empty selection', async () => {
    const { kit, select, copied } = fakeToolkit();
    await openPanel(kit, OPTIONS);

    select('bun run check');
    select('');
    select(null);
    expect(copied).toEqual(['bun run check']);
  });

  it('shows the choices in the list, takes the highlighted one, and asks the next question after', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { select, input } = layoutOf(renderer);

    const first = panel.ask({ question: 'Framework?', options: ['React', 'Vue'], multi: false });
    const second = panel.ask({ question: 'Nome?', options: [], multi: false });
    expect(select.visible).toBe(true);
    expect(select.options.map((option) => option.name)).toEqual(['React', 'Vue']);
    expect(select.height).toBe(2);
    select.selectedIndex = 1;
    select.emit('itemSelected');
    expect(await first).toEqual({ status: 'answered', answer: 'Vue' });

    expect(select.visible).toBe(false);
    expect(input.placeholder).toBe('Nome?');
    input.emit('submit');
    select.emit('itemSelected');
    input.value = 'Ana';
    input.emit('submit');
    expect(await second).toEqual({ status: 'answered', answer: 'Ana' });
  });

  it('keeps a long list of choices inside a bounded scrolling area', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { select } = layoutOf(renderer);
    const options = Array.from({ length: 30 }, (_, index) => `Cidade ${String(index + 1)}`);

    const reply = panel.ask({ question: 'Cidade?', options, multi: false });

    expect(select.height).toBe(8);
    expect(select.options).toHaveLength(30);
    select.selectedIndex = 24;
    select.emit('itemSelected');
    expect(await reply).toEqual({ status: 'answered', answer: 'Cidade 25' });
  });

  it('takes words in the field for a question with choices too, Tab moving between the list and the field', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { select, input } = layoutOf(renderer);

    const reply = panel.ask({ question: 'Framework?', options: ['React', 'Vue'], multi: false });
    expect(select.focused).toBe(1);
    press({ name: 'tab', ctrl: false });
    expect(select.focused).toBe(0);
    expect(input.focused).toBe(2);
    press({ name: 'tab', ctrl: false });
    expect(select.focused).toBe(1);
    input.value = 'Svelte, do zero';
    input.emit('submit');
    expect(await reply).toEqual({ status: 'answered', answer: 'Svelte, do zero' });

    // The list hides and lets go of the keys; Tab with no question is the field's own.
    expect(select.focused).toBe(0);
    press({ name: 'tab', ctrl: false });
    expect(select.focused).toBe(0);
  });

  it('marks several choices with Space, and takes the highlighted one when none is marked', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { select } = layoutOf(renderer);

    const several = panel.ask({ question: 'Quais?', options: ['a', 'b', 'c'], multi: true });
    expect(select.options.map((option) => option.name)).toEqual(['[ ] a', '[ ] b', '[ ] c']);
    select.selectedIndex = 2;
    press({ name: 'space', ctrl: false });
    select.selectedIndex = 0;
    press({ name: 'space', ctrl: false });
    press({ name: 'space', ctrl: false });
    press({ name: 'space', ctrl: false });
    expect(select.options.map((option) => option.name)).toEqual(['[x] a', '[ ] b', '[x] c']);
    select.emit('itemSelected');
    expect(await several).toEqual({ status: 'answered', answer: ['a', 'c'] });

    const none = panel.ask({ question: 'Quais?', options: ['a', 'b'], multi: true });
    select.selectedIndex = 7;
    select.emit('itemSelected');
    select.selectedIndex = 1;
    select.emit('itemSelected');
    expect(await none).toEqual({ status: 'answered', answer: ['b'] });
  });

  it('skips the question with Esc, leaves Space and the scroll keys alone otherwise', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { scroll } = layoutOf(renderer);

    press({ name: 'escape', ctrl: false });
    const words = panel.ask({ question: 'Nome?', options: [], multi: false });
    press({ name: 'space', ctrl: false });
    press({ name: 'pageup', ctrl: false });
    press({ name: 'escape', ctrl: false });
    expect(await words).toEqual({ status: 'skipped' });
    expect(scroll.scrolls).toEqual(['by -1 viewport']);
  });

  it('adds each line at the bottom, its escape codes as colors, and draws the footer again on refresh', async () => {
    const { kit, renderer } = fakeToolkit();
    let width = 0;
    const panel = await openPanel(kit, {
      ...OPTIONS,
      footer: () => {
        width += 1;
        return [`linha ${String(width)}`, 'tabela'];
      },
    });
    panel.write('\u001b[32mok\u001b[0m feito\nsegunda\n');
    panel.write('\u001b[1mfim');
    panel.refresh();

    const { scroll, footer } = layoutOf(renderer);
    expect(scroll.children.map((line) => line.content)).toEqual([
      { chunks: [{ text: 'ok', fg: '#0dbc79' }, { text: ' feito' }] },
      { chunks: [{ text: 'segunda' }] },
      { chunks: [{ text: 'fim', bold: true }] },
    ]);
    expect(footer.content).toEqual({ chunks: [{ text: 'linha 2' }, { text: '\n' }, { text: 'tabela' }] });
    expect(footer.height).toBe(2);
  });

  it('scrolls a page, to the start and to the end, and calls the interrupt listeners on Ctrl+C', async () => {
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const interrupts: string[] = [];
    panel.onInterrupt(() => interrupts.push('stop'));

    for (const name of ['pageup', 'pagedown', 'home', 'end', 'x']) press({ name, ctrl: false });
    press({ name: 'c', ctrl: true });
    press({ name: 'c', ctrl: false });
    expect(interrupts).toEqual([]);
    expect(layoutOf(renderer).input.placeholder).toBe('Tecle Ctrl+C de novo para interromper');
    press({ name: 'c', ctrl: true });

    expect(layoutOf(renderer).scroll.scrolls).toEqual(['by -1 viewport', 'by 1 viewport', 'to 0', 'to 40']);
    expect(interrupts).toEqual(['stop']);
    panel.close();
    expect(renderer.destroyed).toBe(true);
  });
});

describe('openPanelWith', () => {
  it('opens the panel on what the toolkit loads, and gives nothing when it does not load or open', async () => {
    const { kit } = fakeToolkit();
    expect(await openPanelWith(() => Promise.resolve(kit), OPTIONS)).toBeDefined();
    expect(await openPanelWith(() => Promise.resolve(undefined), OPTIONS)).toBeUndefined();
    const failing = fakeToolkit(true).kit;
    expect(await openPanelWith(() => Promise.resolve(failing), OPTIONS)).toBeUndefined();
  });

  it('gives nothing with OpenTUI under Node, where the native module does not load', async () => {
    expect(await loadPanelToolkit()).toBeUndefined();
    expect(await openOpenTuiPanel(OPTIONS)).toBeUndefined();
  });
});

describe('openPanel — Ctrl+C', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('forgets the first Ctrl+C after 2 s, giving the field back what it said', async () => {
    jest.useFakeTimers();
    const { kit, renderer, press } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const interrupts: string[] = [];
    panel.onInterrupt(() => interrupts.push('stop'));
    const { input } = layoutOf(renderer);

    press({ name: 'c', ctrl: true });
    jest.advanceTimersByTime(2000);
    expect(input.placeholder).toBe('Enter envia · Ctrl+J cria uma linha');
    press({ name: 'c', ctrl: true });
    expect(interrupts).toEqual([]);

    void panel.ask({ question: 'Nome?', options: [], multi: false });
    jest.advanceTimersByTime(2000);
    expect(input.placeholder).toBe('Nome?');
    panel.close();
  });
});
