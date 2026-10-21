import type { ShellModule } from '@choliba/shell';

import { clearPanelCommand, panelCommand, providePanel, quitPanelCommand } from './panel.command';

/** What @choliba/tui gives an app's shell: `choliba panel`, and `/clear` and `/quit` in every panel. */
export const tuiShell: ShellModule = {
  name: '@choliba/tui',
  provide: providePanel,
  commands: [panelCommand],
  panel: [clearPanelCommand, quitPanelCommand],
};
