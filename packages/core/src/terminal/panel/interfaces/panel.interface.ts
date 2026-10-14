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
  readonly StyledText: new (chunks: Chunk[]) => Styled;
  /** Plain text, in the renderable's own color: its chunks are what a run with no style of choliba's is. */
  stringToStyledText(content: string): Styled;
  fg(color: string): (input: string) => Chunk;
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
  on(event: 'itemSelected', listener: () => void): unknown;
}

export interface PanelScroll<Node> extends PanelNode<Node> {
  readonly scrollHeight: number;
  scrollBy(delta: number, unit?: 'viewport'): void;
  scrollTo(position: number): void;
}

export interface PanelText<Styled> {
  content: Styled | string;
  height: number | 'auto' | `${number}%`;
}

export interface PanelBoxOptions {
  readonly flexDirection: 'column' | 'row';
  readonly width?: '100%';
  readonly height?: '100%' | number;
  /** A line above and below, as the field's row has. */
  readonly border?: ('top' | 'bottom')[];
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

export interface PanelTextOptions<Styled> {
  readonly content: Styled | string;
  readonly wrapMode: 'word';
  readonly height?: number;
}
