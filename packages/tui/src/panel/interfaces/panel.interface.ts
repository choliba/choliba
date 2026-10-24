import { type PanelKey } from '@choliba/shell';
/**
 * The slice of `@opentui/core` the panel uses, by shape: the real module satisfies it, and a spec passes a fake one
 * (the module is native and does not load under Node, where the specs run). The parameters are the module's own types:
 * what renderables are built on (`RenderContext`), what one takes as a child (`Renderable`), styled text
 * (`StyledText`) and a styled run of it (`TextChunk`).
 */
export interface PanelToolkit<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk> {
  createCliRenderer(config: PanelRendererConfig): Promise<Context & PanelRenderer<Node>>;
  readonly BoxRenderable: new (context: Context, options: PanelBoxOptions) => Node & PanelBox<Node>;
  readonly ScrollBoxRenderable: new (context: Context, options: PanelScrollOptions) => Node & PanelScroll<Node>;
  readonly TextRenderable: new (context: Context, options: PanelTextOptions<Styled>) => Node & PanelText<Styled>;
  readonly TextareaRenderable: new (context: Context, options: PanelTextareaOptions) => Node & PanelInput<Styled>;
  readonly SelectRenderable: new (context: Context, options: PanelSelectOptions) => Node & PanelSelect;
  readonly NativeImage: { load(source: string): Promise<PanelImage> };
  readonly StyledText: new (chunks: Chunk[]) => Styled;
  /** Plain text, in the renderable's own color: its chunks are what a run with no style of choliba's is. */
  stringToStyledText(content: string): Styled;
  fg(color: string): (input: string) => Chunk;
  bg(color: string): (input: Chunk) => Chunk;
  bold(input: Chunk): Chunk;
}

export interface PanelRendererConfig {
  readonly screenMode: 'alternate-screen';
  readonly exitOnCtrlC: boolean;
  readonly useMouse: boolean;
  /** Whether a click focuses what it lands on: off, so the field keeps the keys whatever is clicked. */
  readonly autoFocus: boolean;
  readonly targetFps: number;
}

export interface PanelRenderer<Node> {
  readonly root: PanelNode<Node>;
  readonly width: number;
  readonly keyInput: { on(event: 'keypress', listener: (key: PanelKey) => void): unknown };
  /** Called when the person lets go of the mouse after dragging it over text. */
  on(event: 'selection', listener: (selection: PanelSelection | null) => void): unknown;
  /** Called when the terminal changes size. */
  on(event: 'resize', listener: () => void): unknown;
  /** Puts `text` in the terminal's clipboard (OSC 52); `false` when the terminal does not take it. */
  copyToClipboardOSC52(text: string): boolean;
  destroy(): void;
}

/** The text dragged over with the mouse. */
export interface PanelSelection {
  getSelectedText(): string;
}

/** The toolkit's content and submit events carry no data in the installed API. */
export interface PanelFieldEvent {
  readonly unused?: never;
}

export interface PanelNode<Node> {
  add(child: Node): unknown;
}

export interface PanelBox<Node> extends PanelNode<Node> {
  remove(child: Node): void;
  /** Its column on the screen, once laid out. */
  readonly x: number;
  /** Above its siblings that have a lower one: a card's slot, while the card is dragged over the others. */
  zIndex: number;
  height: number | 'auto' | `${number}%`;
  width: number | 'auto' | `${number}%`;
  visible: boolean;
  /** The title on its top border. */
  set title(title: string | undefined);
  /** Called when the person clicks it. */
  set onMouseDown(listener: ((event: never) => void) | undefined);
}

/** The multiline field of the footer (`TextareaRenderable`): Enter submits and Shift+Enter adds a line. */
export interface PanelInput<Styled> {
  readonly plainText: string;
  readonly virtualLineCount: number;
  height: number | 'auto' | `${number}%`;
  width: number | 'auto' | `${number}%`;
  /** 1 takes the rest of its row; 0 keeps to its `width`. */
  flexGrow: number | null | undefined;
  placeholder: Styled | string | null;
  onSubmit: ((event: PanelFieldEvent) => void) | undefined;
  onContentChange: ((event: PanelFieldEvent) => void) | undefined;
  focus(): void;
  blur(): void;
  setText(text: string): void;
  /** Puts the cursor after the last character. */
  gotoBufferEnd(): unknown;
}

export interface PanelSelectOption {
  readonly name: string;
  readonly description: string;
}

/** A list to choose from (`SelectRenderable`); `itemSelected` is emitted on Enter. */
export interface PanelSelect {
  options: PanelSelectOption[];
  visible: boolean;
  height: number | 'auto' | `${number}%`;
  focus(): void;
  blur(): void;
  getSelectedIndex(): number;
  setSelectedIndex(index: number): void;
  on(event: 'itemSelected', listener: () => void): unknown;
}

/** Where the mouse is, in the terminal's columns, as the toolkit says it of a press, a drag or a release. */
export interface PanelPointer {
  readonly x: number;
}

export interface PanelScroll<Node> extends PanelNode<Node> {
  readonly scrollHeight: number;
  visible: boolean;
  height: number | 'auto' | `${number}%`;
  width: number | 'auto' | `${number}%`;
  /** The title on its top border. */
  set title(title: string | undefined);
  /** Called when the person clicks it. */
  set onMouseDown(listener: ((event: never) => void) | undefined);
  /** Called when the person lets go of the mouse over it, or after dragging it: the event is a `PanelPointer`. */
  set onMouseUp(listener: ((event: never) => void) | undefined);
  /** Called while the person drags it, the event a `PanelPointer`. */
  set onMouseDrag(listener: ((event: never) => void) | undefined);
  /** Drawn this many columns away from its place, which the layout keeps: a card following the mouse. */
  translateX: number;
  /** Its border's color: set as hex, read back as the toolkit keeps it (an object of its own). */
  borderColor: string | object;
  scrollBy(delta: number, unit?: 'viewport'): void;
  scrollTo(position: number): void;
  remove(child: Node): void;
  /** What holds its view inside the border: a child placed on it stays put while the lines scroll. */
  readonly wrapper: PanelNode<Node>;
}

export interface PanelText<Styled> {
  content: Styled | string;
  height: number | 'auto' | `${number}%`;
  visible: boolean;
  /** Called when the person clicks it. */
  set onMouseDown(listener: ((event: never) => void) | undefined);
}

export interface PanelBoxOptions {
  readonly flexDirection: 'column' | 'row';
  readonly width?: '100%' | number;
  readonly height?: '100%' | number;
  /** Space between its children, and inside its left and bottom edges, in cells. */
  readonly gap?: number;
  readonly paddingLeft?: number;
  readonly paddingBottom?: number;
  /** 0 keeps its rows when the panel is short: the lines' box gives up its room instead. */
  readonly flexShrink?: number;
  readonly marginTop?: number;
  /** A hex color behind what the box draws. */
  readonly backgroundColor?: string;
  /** Placed over the layout, at `top`/`left`, above what is there (`zIndex`): it takes no room of its own. */
  readonly position?: 'absolute' | 'relative';
  readonly top?: number;
  readonly left?: number;
  readonly zIndex?: number;
  readonly alignItems?: 'center';
  readonly justifyContent?: 'center';
  /** A line above and below, as the field's row has, one on the left (an agent's lines), or all around. */
  readonly border?: ('top' | 'bottom' | 'left')[] | true;
  /** A hex color for its border; the toolkit's own when absent. */
  readonly borderColor?: string;
  /** `heavy` draws the border with thick lines (`┃`). */
  readonly borderStyle?: 'heavy';
  /** The title on the top border. */
  readonly title?: string;
  readonly paddingRight?: number;
  /** `hidden` cuts what is wider than the box. */
  readonly overflow?: 'hidden';
}

export interface PanelTextareaOptions {
  readonly placeholder: string;
  readonly flexGrow: number;
  readonly height: number;
  readonly maxHeight: number;
  readonly wrapMode: 'word';
  readonly keyBindings: PanelTextareaKeyBinding[];
}

export interface PanelTextareaKeyBinding {
  readonly name: 'return' | 'kpenter' | 'linefeed';
  readonly shift?: boolean;
  readonly action: 'submit' | 'newline';
}

export interface PanelSelectOptions {
  readonly options: PanelSelectOption[];
  readonly showDescription: false;
  readonly showScrollIndicator: true;
  readonly visible: false;
}

export interface PanelScrollOptions {
  readonly flexGrow: number;
  readonly border: boolean;
  readonly title: string;
  readonly titleColor: string;
  /** A hex color for its border; the toolkit's own when absent. */
  readonly borderColor?: string;
  /** Whether it follows its end as lines are added, from `stickyStart`. */
  readonly stickyScroll: boolean;
  readonly stickyStart?: 'bottom';
  /** No horizontal scroll: a long line wraps at the panel's width instead of growing past it. */
  readonly scrollX: false;
  readonly width?: number;
  readonly paddingLeft?: number;
  readonly paddingRight?: number;
  /** 0 keeps its rows when the panel is short. */
  readonly flexShrink?: number;
  /** Placed over the layout, at `top`/`left`, above what is there (`zIndex`): it takes no room of its own. */
  readonly position?: 'absolute';
  readonly top?: number;
  readonly left?: number;
  readonly zIndex?: number;
  /** A hex color behind what it draws, so what it covers does not show through. */
  readonly backgroundColor?: string;
}

/** A decoded picture (`NativeImage`): resized, and read as RGBA pixels. */
export interface PanelImage {
  readonly width: number;
  readonly height: number;
  resize(options: { readonly width: number; readonly height: number; readonly kernel: 'area' }): PanelImage;
  raw(format: 'rgba8'): {
    readonly data: Uint8Array;
    readonly width: number;
    readonly height: number;
    readonly stride: number;
  };
  dispose(): void;
}

export interface PanelTextOptions<Styled> {
  readonly content: Styled | string;
  /** `none` keeps a line whole, for its box to cut. */
  readonly wrapMode: 'word' | 'none';
  readonly height?: number;
  /** 0 keeps its rows when the panel is short. */
  readonly flexShrink?: number;
  /** 1 takes the room left in its row. */
  readonly flexGrow?: number;
  /** Placed in a corner of its parent, `bottom` rows and `right` columns from its edges, or at `top`/`left`. */
  readonly position?: 'absolute';
  readonly bottom?: number;
  readonly right?: number;
  readonly top?: number;
  readonly left?: number;
  readonly width?: number;
  /** Above what is there: a border it is placed on. */
  readonly zIndex?: number;
  /** `false`: pressed, it starts no selection of its text (a card's line, which is dragged with its card). */
  readonly selectable?: boolean;
  /** Out of its place by this many columns, without the room around it changing (negative: over its neighbor). */
  readonly marginLeft?: number;
  readonly marginRight?: number;
}
