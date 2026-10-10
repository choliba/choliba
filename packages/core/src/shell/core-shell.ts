import { ConfigService } from '../config';
import { ThemeService } from '../theme';
import { token } from './container';
import { PLATFORM } from './create-shell';
import type { ShellModule } from './interfaces/shell.interface';

/** The workspace a command runs in and its configuration: `container.get(CONFIG)` in any package's factory. */
export const CONFIG = token<ConfigService>('ConfigService');

/** Whether and how choliba colors its output: `container.get(THEME)` in any package's factory. */
export const THEME = token<ThemeService>('ThemeService');

/**
 * What @choliba/core gives the shell: the configuration and the theme, built from the platform, for every package.
 * Its commands (the root, help and completion) move here when the last command leaves Nest.
 */
export const coreShell: ShellModule = {
  name: '@choliba/core',
  provide: (container) => {
    container.provide(CONFIG, (c) => {
      const { cwd, env } = c.get(PLATFORM);
      return new ConfigService(cwd, env);
    });
    container.provide(THEME, (c) => {
      const { env, stdout, noColorFlag } = c.get(PLATFORM);
      return new ThemeService(c.get(CONFIG), env, stdout, noColorFlag);
    });
  },
  commands: [],
};
