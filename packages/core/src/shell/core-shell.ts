import { ConfigService } from '../config';
import { ThemeService } from '../theme';
import { PLATFORM } from './create-shell';
import type { ShellModule } from './interfaces/shell.interface';
import { CONFIG, THEME } from './shell.constants';
import { provideTerminal, terminalCommand } from './terminal.command';

/**
 * What @choliba/core gives the shell: the configuration, the theme and `terminal run`, built from the platform.
 */
export const coreShell: ShellModule = {
  name: '@choliba/core',
  provide: (container) => {
    container.provide(CONFIG, (current) => {
      const { cwd, env } = current.get(PLATFORM);
      return new ConfigService(cwd, env);
    });
    container.provide(THEME, (current) => {
      const { env, stdout, noColorFlag } = current.get(PLATFORM);
      return new ThemeService(current.get(CONFIG), env, stdout, noColorFlag);
    });
    provideTerminal(container);
  },
  commands: [terminalCommand],
};
