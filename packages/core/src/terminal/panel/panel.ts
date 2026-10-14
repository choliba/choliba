import type { AnsiColor } from '../../theme';
import { ansiChunks, type StyledChunk } from '../frame';

import type { PanelKey, PanelToolkit } from './interfaces/panel.interface';

/**
 * The 16 colors as the panel paints them. A terminal paints its own palette; the panel draws its cells itself, so it
 * picks one: the default dark palette of the most common editor terminal.
 */
const PALETTE: Readonly<Record<AnsiColor, string>> = {
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  gray: '#666666',
  'bright-red': '#f14c4c',
  'bright-green': '#23d18b',
  'bright-yellow': '#f5f543',
  'bright-blue': '#3b8eea',
  'bright-magenta': '#d670d6',
  'bright-cyan': '#29b8db',
};

/** How often the footer is drawn again; also the panel's frame rate. */
const FRAMES_PER_SECOND = 30;

export interface PanelOptions {
  /** The title of the panel: for a run, the agent. */
  readonly title: string;
  readonly titleColor: AnsiColor;
  /** The footer's lines in a width, with their escape codes. */
  readonly footer: (width: number) => readonly string[];
}

/** A run drawn in a panel of its own: the session's lines scroll in it, under them the footer. */
export interface Panel {
  /** Lines of the session, with their escape codes: each one is added at the bottom. */
  write(text: string): void;
  /** Draws the footer again, as it is now. */
  refresh(): void;
  /** Called when the person presses Ctrl+C, which the panel's keyboard takes before the terminal makes a signal. */
  onInterrupt(listener: () => void): void;
  /** Gives the terminal back as it was; the panel's lines are the caller's to print. */
  close(): void;
}

/** What a key does to the panel: scroll it a page, to the start or to the end, or interrupt the run. */
function keyAction(key: PanelKey): 'page-up' | 'page-down' | 'top' | 'bottom' | 'interrupt' | undefined {
  if (key.ctrl && key.name === 'c') return 'interrupt';
  if (key.name === 'pageup') return 'page-up';
  if (key.name === 'pagedown') return 'page-down';
  if (key.name === 'home') return 'top';
  if (key.name === 'end') return 'bottom';
  return undefined;
}

/**
 * The panel on `kit` (OpenTUI): the alternate screen, a scroll box titled with the agent that follows the end until
 * the person scrolls up (mouse wheel, PgUp/PgDn, Home/End), and the footer under it. Escape codes become the toolkit's
 * own styles (`ansiChunks`).
 */
export async function openPanel<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  kit: PanelToolkit<Context, Node, Styled, Chunk>,
  options: PanelOptions,
): Promise<Panel> {
  const renderer = await kit.createCliRenderer({
    screenMode: 'alternate-screen',
    exitOnCtrlC: false,
    useMouse: true,
    targetFps: FRAMES_PER_SECOND,
  });
  const styled = (lines: readonly string[]): Styled => {
    const chunks = lines.flatMap((line, index) => [
      ...(index === 0 ? [] : kit.stringToStyledText('\n').chunks),
      ...ansiChunks(line).flatMap(styledChunks),
    ]);
    return new kit.StyledText(chunks);
  };
  const styledChunks = (piece: StyledChunk): Chunk[] => {
    const colored =
      piece.color === undefined
        ? kit.stringToStyledText(piece.text).chunks
        : [kit.fg(PALETTE[piece.color])(piece.text)];
    return piece.bold ? colored.map((chunk) => kit.bold(chunk)) : colored;
  };

  const layout = new kit.BoxRenderable(renderer, { flexDirection: 'column', width: '100%', height: '100%' });
  const scroll = new kit.ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    border: true,
    title: ` ${options.title} `,
    titleColor: PALETTE[options.titleColor],
    stickyScroll: true,
    stickyStart: 'bottom',
    scrollX: false,
  });
  const footer = new kit.TextRenderable(renderer, { content: '', wrapMode: 'word' });
  layout.add(scroll);
  layout.add(footer);
  renderer.root.add(layout);

  const interrupts: (() => void)[] = [];
  const scrollActions: Readonly<Record<string, () => void>> = {
    'page-up': () => {
      scroll.scrollBy(-1, 'viewport');
    },
    'page-down': () => {
      scroll.scrollBy(1, 'viewport');
    },
    top: () => {
      scroll.scrollTo(0);
    },
    bottom: () => {
      scroll.scrollTo(scroll.scrollHeight);
    },
    interrupt: () => {
      interrupts.forEach((listener) => {
        listener();
      });
    },
  };
  renderer.keyInput.on('keypress', (key) => {
    const action = keyAction(key);
    if (action !== undefined) scrollActions[action]?.();
  });

  const refresh = (): void => {
    const lines = options.footer(renderer.width);
    footer.content = styled(lines);
    footer.height = lines.length;
  };
  refresh();

  return {
    write: (text) => {
      const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
      for (const line of lines)
        scroll.add(new kit.TextRenderable(renderer, { content: styled([line]), wrapMode: 'word' }));
    },
    refresh,
    onInterrupt: (listener) => {
      interrupts.push(listener);
    },
    close: () => {
      renderer.destroy();
    },
  };
}
