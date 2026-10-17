import type { RenderContext, Renderable, StyledText, TextChunk } from '@opentui/core';

import type { PanelToolkit } from './interfaces/panel.interface';
import { openPanel, type ChatPanel, type PanelOptions } from './panel';

/** The panel's toolkit as OpenTUI gives it. */
export type OpenTuiToolkit = PanelToolkit<RenderContext, Renderable, StyledText, TextChunk>;

/**
 * OpenTUI, loaded only when a run draws its panel. `undefined` where it does not load: Node without FFI (the specs),
 * or a platform with no native build; the run then keeps the screen it always had.
 */
export async function loadPanelToolkit(): Promise<OpenTuiToolkit | undefined> {
  try {
    return await import('@opentui/core');
  } catch {
    return undefined;
  }
}

/**
 * Opens the panel on what `load` gives: `undefined` when the toolkit does not load or the panel does not open (a
 * terminal it cannot set up), so the run keeps the screen it always had.
 */
export async function openPanelWith<Context, Node, Styled extends { readonly chunks: Chunk[] }, Chunk>(
  load: () => Promise<PanelToolkit<Context, Node, Styled, Chunk> | undefined>,
  options: PanelOptions,
): Promise<ChatPanel | undefined> {
  const kit = await load();
  if (kit === undefined) return undefined;
  try {
    return await openPanel(kit, options);
  } catch {
    return undefined;
  }
}

/** The panel on OpenTUI, what a run on a terminal draws. */
export function openOpenTuiPanel(options: PanelOptions): Promise<ChatPanel | undefined> {
  return openPanelWith(loadPanelToolkit, options);
}
