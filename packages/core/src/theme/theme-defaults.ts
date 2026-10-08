import type { ThemeTable } from './interfaces/theme.interface';

/** The colors choliba ships with; `CHOL_COLORS` changes any of them. */
export const DEFAULT_THEME: ThemeTable = {
  providers: { claude: 'magenta', cursor: 'cyan' },
  // test-writer and implementer in the colors of their TDD phase (red, then green).
  agents: { 'product-owner': 'blue', 'test-writer': 'red', implementer: 'green', 'docs-updater': 'cyan' },
  // An error is bright red, so it does not read as the test-writer's label.
  states: { error: 'bright-red', success: 'green', warning: 'yellow', hint: 'gray' },
  gates: { red: 'red', green: 'green' },
  labels: { provider: 'magenta' },
};

export const THEME_ROLES = ['providers', 'agents', 'states', 'gates', 'labels'] as const;
