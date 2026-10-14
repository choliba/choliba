import type { PanelKey, PanelRendererConfig, PanelToolkit } from '../../terminal/panel/interfaces/panel.interface';
import { loadPanelToolkit, openOpenTuiPanel, openPanelWith } from '../../terminal/panel/panel-toolkit';
import { openPanel } from '../../terminal/panel/panel';

interface FakeChunk {
  readonly text: string;
  readonly fg?: string;
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
  placeholder = '';
  visible = true;
  focused = 0;
  selectedIndex = 0;
  options: { name: string; description: string }[] = [];
  private readonly listeners = new Map<string, (() => void)[]>();

  constructor(
    readonly kind: string,
    readonly built: Readonly<Record<string, unknown>>,
  ) {
    const placeholder = built['placeholder'];
    if (typeof placeholder === 'string') this.placeholder = placeholder;
    if (built['visible'] === false) this.visible = false;
    const content = built['content'];
    if (typeof content === 'string' || (typeof content === 'object' && content !== null)) {
      this.content = content as FakeStyled | string;
    }
  }

  add(child: FakeNode): number {
    this.children.push(child);
    return this.children.length;
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

  on(event: string, listener: () => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    return this;
  }

  emit(event: string): void {
    (this.listeners.get(event) ?? []).forEach((listener) => {
      listener();
    });
  }
}

function fakeToolkit(failToOpen = false) {
  const keys: ((key: PanelKey) => void)[] = [];
  const configs: PanelRendererConfig[] = [];
  const renderer = {
    root: new FakeNode('root', {}),
    width: 60,
    destroyed: false,
    keyInput: {
      on: (_event: 'keypress', listener: (key: PanelKey) => void) => {
        keys.push(listener);
      },
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
    InputRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('input', options as Record<string, unknown>);
      }
    },
    SelectRenderable: class extends FakeNode {
      constructor(_context: Renderer, options: object) {
        super('select', options as Record<string, unknown>);
      }
    },
    StyledText: class {
      constructor(readonly chunks: FakeChunk[]) {}
    },
    stringToStyledText: (content) => ({ chunks: [{ text: content }] }),
    fg: (color) => (input) => ({ text: input, fg: color }),
    bold: (input) => ({ ...input, bold: true }),
  };
  const press = (key: PanelKey): void => {
    keys.forEach((listener) => {
      listener(key);
    });
  };
  return { kit, renderer, configs, press };
}

const OPTIONS = {
  title: 'test-writer',
  titleColor: 'cyan' as const,
  footer: (width: number) => [`\u001b[1mprovider\u001b[22m largura ${String(width)}`],
  hint: 'Escreva para o agente e tecle Enter',
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

    expect(configs).toEqual([{ screenMode: 'alternate-screen', exitOnCtrlC: false, useMouse: true, targetFps: 30 }]);
    const { scroll, footer } = layoutOf(renderer);
    expect(scroll.built).toMatchObject({ title: ' test-writer ', titleColor: '#11a8cd', stickyScroll: true });
    expect(footer.content).toEqual({ chunks: [{ text: 'provider', bold: true }, { text: ' largura 60' }] });
    expect(footer.height).toBe(1);
  });

  it('puts the field on the left of the footer, focused, with the hint, and the list hidden', async () => {
    const { kit, renderer } = fakeToolkit();
    await openPanel(kit, OPTIONS);

    const { select, bottom, prompt, input } = layoutOf(renderer);
    expect(bottom.built).toMatchObject({ flexDirection: 'row', border: ['top', 'bottom'] });
    expect(bottom.height).toBe(3);
    expect(prompt.content).toBe('❯ ');
    expect(input.built).toMatchObject({ flexGrow: 1 });
    expect(input.placeholder).toBe('Escreva para o agente e tecle Enter');
    expect(input.focused).toBe(1);
    expect(select.visible).toBe(false);
  });

  it('asks in the field and takes the answer in words, then sends what is typed with no question', async () => {
    const { kit, renderer } = fakeToolkit();
    const panel = await openPanel(kit, OPTIONS);
    const { input } = layoutOf(renderer);
    const sent: string[] = [];
    panel.onMessage((text) => sent.push(text));

    const reply = panel.ask({ question: 'Qual o nome?', options: [], multi: false });
    expect(input.placeholder).toBe('Qual o nome?');
    input.emit('enter');
    input.value = ' Jackson ';
    input.emit('enter');
    expect(await reply).toEqual({ status: 'answered', answer: 'Jackson' });

    expect(input.placeholder).toBe('Escreva para o agente e tecle Enter');
    input.value = 'continue com React';
    input.emit('enter');
    expect(sent).toEqual(['continue com React']);
    expect(input.value).toBe('');
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
    input.emit('enter');
    select.emit('itemSelected');
    input.value = 'Ana';
    input.emit('enter');
    expect(await second).toEqual({ status: 'answered', answer: 'Ana' });
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
    input.emit('enter');
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
    expect(input.placeholder).toBe('Escreva para o agente e tecle Enter');
    press({ name: 'c', ctrl: true });
    expect(interrupts).toEqual([]);

    void panel.ask({ question: 'Nome?', options: [], multi: false });
    jest.advanceTimersByTime(2000);
    expect(input.placeholder).toBe('Nome?');
    panel.close();
  });
});
