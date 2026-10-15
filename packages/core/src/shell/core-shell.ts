import { ThemeService } from '../theme';
import { PLATFORM } from './create-shell';
import type { ShellModule } from './interfaces/shell.interface';
import { THEME, THEME_CHOICES } from './shell.constants';
import { panelCommand, providePanel } from './panel.command';
import { provideTerminal, terminalCommand } from './terminal.command';

/**
 * What @choliba/core gives the shell: the configuration, the theme, `terminal run`, `panel`, `list config` and `set config`, built
 * from the platform.
 */
export const coreShell: ShellModule = {
  name: '@choliba/core',
  provide: (container) => {
    container.provide(THEME, (current) => {
      const { env, stdout, noColorFlag } = current.get(PLATFORM);
      const choices = current.has(THEME_CHOICES) ? current.get(THEME_CHOICES) : {};
      return new ThemeService(env, stdout, noColorFlag, choices);
    });
    provideTerminal(container);
    providePanel(container);
  },
  commands: [terminalCommand, panelCommand],
};
