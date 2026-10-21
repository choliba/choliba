// The panel: OpenTUI drawing the contract of @choliba/shell (a chat, its field, its cards and choices), and `choliba
// panel`, its session, its log and the panel commands every app has (`/clear`, `/quit`).
export {
  loadPanelToolkit,
  openOpenTuiPanel,
  openPanel,
  openPanelWith,
  createPanelRunScreen,
  pixelMap,
  projectsPanel,
  type ArtColor,
  type OpenTuiToolkit,
  type PanelToolkit,
  type PanelRunScreen,
  type PanelRunScreenOptions,
} from './panel';
export {
  clearPanelCommand,
  PANEL_ICON,
  PANEL_LOGO,
  PANEL_OPENER,
  PANEL_SPEC,
  PANEL_VERSION,
  panelCommand,
  providePanel,
  quitPanelCommand,
  tuiShell,
} from './session';
