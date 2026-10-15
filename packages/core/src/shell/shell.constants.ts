import { token } from './container';
import type { ConfigService } from '../config';
import type { ThemeService } from '../theme';
import type { ThemeChoices } from '../theme';

/** The workspace a command runs in and its configuration: `container.get(CONFIG)` in any package's factory. */
export const CONFIG = token<ConfigService>('ConfigService');

/** Whether and how choliba colors its output: `container.get(THEME)` in any package's factory. */
export const THEME = token<ThemeService>('ThemeService');
/** Choices an app read for the theme; a shell without them uses the legacy workspace configuration bridge. */
export const THEME_CHOICES = token<ThemeChoices>('ThemeChoices');
