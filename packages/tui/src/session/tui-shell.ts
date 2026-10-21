import type { ShellModule } from '@choliba/shell';

import { agentsPanel, projectsPanel, watchChoices } from '../panel';
import { clearPanelCommand, panelCommand, providePanel, quitPanelCommand } from './panel.command';

/** What @choliba/tui gives an app's shell: `choliba panel` and its panel commands. */
export const tuiShell: ShellModule = {
  name: '@choliba/tui',
  provide: providePanel,
  commands: [panelCommand],
  panel: [clearPanelCommand, quitPanelCommand, ...projectsPanel, ...agentsPanel],
  panelStart: watchChoices,
};
