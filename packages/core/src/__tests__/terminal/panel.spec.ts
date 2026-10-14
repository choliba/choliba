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

  constructor(
    readonly kind: string,
    readonly options: Readonly<Record<string, unknown>>,
  ) {
    const content = options['content'];
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
};

function layoutOf(renderer: ReturnType<typeof fakeToolkit>['renderer']) {
  const [layout] = renderer.root.children;
  const [scroll, footer] = layout?.children ?? [];
  if (scroll === undefined || footer === undefined) throw new Error('no layout');
  return { scroll, footer };
}

describe('openPanel', () => {
  it('opens on the alternate screen, keeping Ctrl+C, with the agent as the title and the footer under the lines', async () => {
    const { kit, renderer, configs } = fakeToolkit();
    await openPanel(kit, OPTIONS);

    expect(configs).toEqual([{ screenMode: 'alternate-screen', exitOnCtrlC: false, useMouse: true, targetFps: 30 }]);
    const { scroll, footer } = layoutOf(renderer);
    expect(scroll.options).toMatchObject({ title: ' test-writer ', titleColor: '#11a8cd', stickyScroll: true });
    expect(footer.content).toEqual({ chunks: [{ text: 'provider', bold: true }, { text: ' largura 60' }] });
    expect(footer.height).toBe(1);
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
