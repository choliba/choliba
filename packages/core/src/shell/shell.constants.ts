import { token } from './container';
import type { ThemeService } from '../theme';
import type { ThemeChoices } from '../theme';

/** The workspace selected by the app; core defines only the integration token, not how it is found. */
export const WORKSPACE_ROOT = token<string>('WorkspaceRoot');

/** Whether and how choliba colors its output: `container.get(THEME)` in any package's factory. */
export const THEME = token<ThemeService>('ThemeService');
/** Choices an app read for the theme. */
export const THEME_CHOICES = token<ThemeChoices>('ThemeChoices');
