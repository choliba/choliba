import type { AnsiColor } from '../../theme';
import { ansiChunks, type StyledChunk } from '../frame';

import type { PanelKey, PanelTextareaKeyBinding, PanelToolkit } from './interfaces/panel.interface';
import { PALETTE } from './panel-palette';
import { questionDesk, type PanelQuestion, type PanelReply } from './panel-question';
import { headerBox, splashBox, type PanelHeader, type PanelSplash } from './panel-welcome';

/** The band behind what the person said: a gray a little lighter than a dark terminal. */
const SAID_BACKGROUND = '#373737';

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
  /** The footer's line in a width, with its escape codes: on the right of the field, or under it with a header. */
  readonly footer: (width: number) => readonly string[];
  /** What the field says while no question is pending. */
  readonly hint: string;
  /**
   * A welcome in the center of the panel, with no box nor field: Enter (or the first line written) closes it and shows
   * them; Esc calls the interrupt listeners at once. Absent, the panel opens with the field.
   */
  readonly splash?: PanelSplash;
  /**
   * A header above the lines, which then take the whole width with no border, and the footer as a status line under
   * the field. Absent, the lines are in a box titled with `title`, and the footer on the right of the field.
   */
  readonly header?: PanelHeader;
}

export type { PanelHeader, PanelSplash };

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

/** A panel where a person talks: what they said is marked apart from the other lines. */
export interface ChatPanel extends Panel {
  /** What the person said, added at the bottom on a band of its own after a blank row: `❯` and the text. */
  say(text: string): void;
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
 * questions are asked and messages typed, and the footer on the right. With a header, the header above the lines,
 * which have no border, and the footer under the field. A welcome may come first. Escape codes become the toolkit's
 * own styles (`ansiChunks`).
 */
export async function openPanel<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  kit: PanelToolkit<Context, Node, Styled, Chunk>,
  options: PanelOptions,
): Promise<ChatPanel> {
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

  const welcome = { kit, renderer, styled };
  const compact = options.header !== undefined;
  const layout = new kit.BoxRenderable(renderer, { flexDirection: 'column', width: '100%', height: '100%' });
  const header = options.header === undefined ? undefined : headerBox(welcome, options.header);
  const scroll = new kit.ScrollBoxRenderable(renderer, {
    flexGrow: 1,
    border: !compact,
    title: compact ? '' : ` ${options.title} `,
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
  if (!compact) bottom.add(footer);
  if (header !== undefined) layout.add(header);
  layout.add(scroll);
  layout.add(select);
  layout.add(bottom);
  // With a header the footer is a status line of its own, under the field.
  if (compact) layout.add(footer);
  const splash = options.splash === undefined ? undefined : await splashBox(welcome, options.splash);
  if (splash !== undefined) layout.add(splash);
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
  // A welcome hides the field until Enter: then, or when a line is written first, the field shows, focused.
  // The box stays hidden too, so its border never shows under the welcome.
  let welcoming = splash !== undefined;
  const behind = [header, scroll, bottom, ...(compact ? [footer] : [])];
  const show = (visible: boolean): void => {
    for (const node of behind) if (node !== undefined) node.visible = visible;
  };
  show(!welcoming);
  if (!welcoming) input.focus();
  const begin = (): void => {
    if (splash === undefined || !welcoming) return;
    welcoming = false;
    splash.visible = false;
    show(true);
    input.focus();
  };

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
    if (welcoming && (key.name === 'return' || key.name === 'kpenter')) {
      begin();
      return;
    }
    // On the welcome nothing runs yet, so Esc leaves at once: the interrupt listeners, with no second key.
    if (welcoming && key.name === 'escape') {
      interrupts.forEach((listener) => {
        listener();
      });
      return;
    }
    if (desk.key(key)) return;
    const action = keyAction(key);
    if (action !== undefined) scrollActions[action]?.();
  });

  const refresh = (): void => {
    const lines = options.footer(renderer.width);
    // Beside the field, the footer's lines make its row taller; under it, they are rows of their own.
    footerLineCount = compact ? 0 : lines.length;
    footer.content = styled(lines);
    footer.height = lines.length;
    // The tallest content, plus the line above and the one below.
    resizeInput();
  };
  refresh();

  return {
    write: (text) => {
      begin();
      const lines = (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
      for (const line of lines)
        scroll.add(new kit.TextRenderable(renderer, { content: styled([line]), wrapMode: 'word' }));
    },
    say: (text) => {
      begin();
      const band = new kit.BoxRenderable(renderer, {
        flexDirection: 'row',
        marginTop: 1,
        paddingLeft: 1,
        backgroundColor: SAID_BACKGROUND,
      });
      band.add(new kit.TextRenderable(renderer, { content: styled([`❯ ${text}`]), wrapMode: 'word' }));
      scroll.add(band);
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
