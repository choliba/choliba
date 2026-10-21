import { baseShell, type ShellModule } from '@choliba/shell';
import { clearPanelCommand, quitPanelCommand, tuiShell } from '@choliba/tui';

/** What @choliba/core gives the shell: the shell's own (the theme, `terminal run`) and the panel's (`panel`, `/clear`, `/quit`). */
export const coreShell: ShellModule = {
  name: '@choliba/core',
  provide: (container) => {
    baseShell.provide?.(container);
    tuiShell.provide?.(container);
  },
  commands: [...baseShell.commands, ...tuiShell.commands],
  panel: [clearPanelCommand, quitPanelCommand],
};
