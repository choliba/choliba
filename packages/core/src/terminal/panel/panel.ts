import type { AnsiColor } from '../../theme';
import { ansiChunks, type StyledChunk } from '../frame';

import type { PanelKey, PanelTextareaKeyBinding, PanelToolkit } from './interfaces/panel.interface';
import { questionDesk, type PanelQuestion, type PanelReply } from './panel-question';

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

/** How long a first Ctrl+C waits for the second, which interrupts the run. */
const INTERRUPT_WINDOW_MS = 2000;

/** What the field says between the first Ctrl+C and the second. */
const INTERRUPT_NOTICE = 'Tecle Ctrl+C de novo para interromper';

/** How often the footer is drawn again; also the panel's frame rate. */
const FRAMES_PER_SECOND = 30;

/** The input grows with its wrapped content up to this many terminal rows. */
const MAX_INPUT_LINES = 5;

const TEXTAREA_KEYS: PanelTextareaKeyBinding[] = [
  { name: 'return', action: 'submit' },
  { name: 'return', shift: true, action: 'newline' },
  { name: 'kpenter', action: 'submit' },
  { name: 'kpenter', shift: true, action: 'newline' },
  // Ctrl+J is LF in every terminal; some terminals also encode Shift+Enter as LF without its modifier.
  { name: 'linefeed', action: 'newline' },
  { name: 'linefeed', shift: true, action: 'newline' },
];

export interface PanelOptions {
  /** The title of the panel: for a run, the agent. */
  readonly title: string;
  readonly titleColor: AnsiColor;
  /** The footer's line in a width, with its escape codes: it goes on the right of the field. */
  readonly footer: (width: number) => readonly string[];
  /** What the field says while no question is pending. */
  readonly hint: string;
}

/** A run drawn in a panel of its own: the session's lines scroll in it, under them the footer. */
export interface Panel {
  /** Lines of the session, with their escape codes: each one is added at the bottom. */
  write(text: string): void;
  /** Draws the footer again, as it is now. */
  refresh(): void;
  /** Called when the person presses Ctrl+C, which the panel's keyboard takes before the terminal makes a signal. */
  onInterrupt(listener: () => void): void;
  /** Asks `question` in the field and gives the answer; questions asked together wait their turn. */
  ask(question: PanelQuestion): Promise<PanelReply>;
  /** Called with what the person typed and sent in the field while no question was pending. */
  onMessage(listener: (text: string) => void): void;
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
 * the person scrolls up (mouse wheel, PgUp/PgDn, Home/End), and under it one row: the field on the left, where
 * questions are asked and messages typed, and the footer on the right. Escape codes become the toolkit's
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
  const select = new kit.SelectRenderable(renderer, {
    options: [],
    showDescription: false,
    showScrollIndicator: true,
    visible: false,
  });
  const bottom = new kit.BoxRenderable(renderer, { flexDirection: 'row', border: ['top', 'bottom'] });
  const prompt = new kit.TextRenderable(renderer, { content: '❯ ', wrapMode: 'word' });
  const input = new kit.TextareaRenderable(renderer, {
    placeholder: options.hint,
    flexGrow: 1,
    height: 1,
    maxHeight: MAX_INPUT_LINES,
    wrapMode: 'word',
    keyBindings: TEXTAREA_KEYS,
  });
  const footer = new kit.TextRenderable(renderer, { content: '', wrapMode: 'word' });
  bottom.add(prompt);
  bottom.add(input);
  bottom.add(footer);
  layout.add(scroll);
  layout.add(select);
  layout.add(bottom);
  renderer.root.add(layout);
  let footerLineCount = 0;
  const resizeInput = (): void => {
    // OpenTUI emits the content event before its wrapped-line view always reflects a newly inserted newline.
    const logicalLineCount = input.plainText.split('\n').length;
    input.height = Math.min(MAX_INPUT_LINES, Math.max(1, logicalLineCount, input.virtualLineCount));
    bottom.height = Math.max(input.height, footerLineCount) + 2;
  };
  input.onContentChange = resizeInput;
  const desk = questionDesk(input, select, options.hint);
  input.focus();

  const interrupts: (() => void)[] = [];
  let armed: ReturnType<typeof setTimeout> | undefined;
  // The first Ctrl+C only warns in the field; a second one before the window closes interrupts the run.
  const interrupt = (): void => {
    if (armed === undefined) {
      const before = input.placeholder;
      input.placeholder = INTERRUPT_NOTICE;
      armed = setTimeout(() => {
        armed = undefined;
        if (input.placeholder === INTERRUPT_NOTICE) input.placeholder = before;
      }, INTERRUPT_WINDOW_MS);
      return;
    }
    clearTimeout(armed);
    armed = undefined;
    interrupts.forEach((listener) => {
      listener();
    });
  };
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
    interrupt,
  };
  renderer.keyInput.on('keypress', (key) => {
    if (desk.key(key)) return;
    const action = keyAction(key);
    if (action !== undefined) scrollActions[action]?.();
  });

  const refresh = (): void => {
    const lines = options.footer(renderer.width);
    footerLineCount = lines.length;
    footer.content = styled(lines);
    footer.height = lines.length;
    // The tallest content, plus the line above and the one below.
    resizeInput();
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
    ask: (question) => desk.ask(question),
    onMessage: (listener) => {
      desk.onMessage(listener);
    },
    close: () => {
      clearTimeout(armed);
      renderer.destroy();
    },
  };
}
