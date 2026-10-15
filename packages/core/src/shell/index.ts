export { Container, token, type Factory, type Token } from './container';
export { CONFIG_CATALOG, createShell, PANEL_COMMANDS, PLATFORM, type Shell } from './create-shell';
export type {
  PanelCommand,
  PanelCommandContext,
  PanelContext,
  ShellCommand,
  ShellModule,
  ShellRoot,
  ShellVerb,
} from './interfaces/shell.interface';
export { ShellIo, type ShellStreams } from './shell-io';
export { coreShell } from './core-shell';
export { PANEL_ICON, PANEL_LOGO, PANEL_OPENER, PANEL_SPEC, PANEL_VERSION } from './panel.command';
export { TERMINAL_RUN_SPEC } from './terminal.command';
export { THEME, THEME_CHOICES, WORKSPACE_ROOT } from './shell.constants';
