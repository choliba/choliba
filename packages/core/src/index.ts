// What @choliba/core gave before the restructure, gathered again: the kernel, the shell and the panel, which now live in
// packages of their own. This entry keeps exporting the same names until the bridges go.
// Functions, types and tokens, free of decorators: the Playwright runner loads code that imports them with its own
// Babel, which does not accept parameter decorators.
export * from '@choliba/kernel';
export * from '@choliba/shell';
export {
  loadPanelToolkit,
  openOpenTuiPanel,
  openPanel,
  openPanelWith,
  createPanelRunScreen,
  PANEL_ICON,
  PANEL_LOGO,
  PANEL_OPENER,
  PANEL_SPEC,
  PANEL_VERSION,
  pixelMap,
  type ArtColor,
  type OpenTuiToolkit,
  type PanelToolkit,
  type PanelRunScreen,
  type PanelRunScreenOptions,
} from '@choliba/tui/panel';
export * from './shell';
