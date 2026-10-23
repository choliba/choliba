import type { ShellModule } from '@choliba/shell';

import { listAgentsCommand } from './agents-list.command';
import { runAgentCommand } from './agents-run.command';

/** The app-owned commands that use the agents package's services. */
export const agentsCommandsShell: ShellModule = {
  name: 'choliba-agents-commands',
  commands: [runAgentCommand, listAgentsCommand],
};
