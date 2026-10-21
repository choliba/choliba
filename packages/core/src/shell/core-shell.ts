import { baseShell, type ShellModule } from '@choliba/shell';

import { clearPanelCommand, panelCommand, providePanel, quitPanelCommand } from './panel.command';

/**
 * What @choliba/core gives the shell: the shell's own (the theme, `terminal run`) and the panel: `panel`, `/clear` and
 * `/quit`.
 */
export const coreShell: ShellModule = {
  ...baseShell,
  name: '@choliba/core',
  provide: (container) => {
    baseShell.provide?.(container);
    providePanel(container);
  },
  commands: [...baseShell.commands, panelCommand],
  panel: [clearPanelCommand, quitPanelCommand],
};
