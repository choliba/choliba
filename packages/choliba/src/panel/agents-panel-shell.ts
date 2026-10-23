import type { ShellModule } from '@choliba/shell';

import { agentsPanel } from './agents-panel';
import { watchChoices } from './agents-panel-watch';

export const agentsPanelShell: ShellModule = {
  name: 'choliba-agents-panel',
  commands: [],
  panel: [...agentsPanel],
  panelStart: watchChoices,
};
