import { baseShell, type ShellModule } from '@choliba/shell';

/** What @choliba/core gives the shell: the theme and `terminal run`. The panel is `@choliba/tui`. */
export const coreShell: ShellModule = {
  name: '@choliba/core',
  provide: (container) => {
    baseShell.provide?.(container);
  },
  commands: [...baseShell.commands],
};
