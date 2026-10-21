import { ThemeService } from '../theme';
import { PLATFORM } from './create-shell';
import type { ShellModule } from './interfaces/shell.interface';
import { THEME, THEME_CHOICES } from './shell.constants';
import { provideTerminal, terminalCommand } from './terminal.command';

/** What the shell gives every app: the theme, built from the platform, and `terminal run`. */
export const baseShell: ShellModule = {
  name: '@choliba/shell',
  provide: (container) => {
    container.provide(THEME, (current) => {
      const { env, stdout, noColorFlag } = current.get(PLATFORM);
      const choices = current.has(THEME_CHOICES) ? current.get(THEME_CHOICES) : {};
      return new ThemeService(env, stdout, noColorFlag, choices);
    });
    provideTerminal(container);
  },
  commands: [terminalCommand],
};
