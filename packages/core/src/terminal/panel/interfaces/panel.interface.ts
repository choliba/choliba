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
  readonly targetFps: number;
}

export interface PanelRenderer<Node> {
  readonly root: PanelNode<Node>;
  readonly width: number;
  readonly keyInput: { on(event: 'keypress', listener: (key: PanelKey) => void): unknown };
  destroy(): void;
}

export interface PanelKey {
  readonly name: string;
  readonly ctrl: boolean;
  readonly shift?: boolean;
}

/** The toolkit's content and submit events carry no data in the installed API. */
export interface PanelFieldEvent {
  readonly unused?: never;
}

export interface PanelNode<Node> {
  add(child: Node): unknown;
}

export interface PanelBox<Node> extends PanelNode<Node> {
  height: number | 'auto' | `${number}%`;
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
  placeholder: Styled | string | null;
  onSubmit: ((event: PanelFieldEvent) => void) | undefined;
  onContentChange: ((event: PanelFieldEvent) => void) | undefined;
  focus(): void;
  blur(): void;
  setText(text: string): void;
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

export interface PanelScroll<Node> extends PanelNode<Node> {
  readonly scrollHeight: number;
  visible: boolean;
  scrollBy(delta: number, unit?: 'viewport'): void;
  scrollTo(position: number): void;
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
  /** A line above and below, as the field's row has, or all around. */
  readonly border?: ('top' | 'bottom')[] | true;
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
  readonly stickyScroll: boolean;
  readonly stickyStart: 'bottom';
  /** No horizontal scroll: a long line wraps at the panel's width instead of growing past it. */
  readonly scrollX: false;
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
  /** Placed in a corner of its parent, `bottom` rows and `right` columns from its edges. */
  readonly position?: 'absolute';
  readonly bottom?: number;
  readonly right?: number;
}
