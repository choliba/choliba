export { CONFIG_CATALOG, createShell, PANEL_COMMANDS, PANEL_STARTS, PLATFORM, type Shell } from './create-shell';
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
export { baseShell } from './base-shell';
export { TERMINAL_RUN_SPEC } from './terminal.command';
export { THEME, THEME_CHOICES, WORKSPACE_ROOT } from './shell.constants';
