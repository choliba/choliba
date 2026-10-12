import { CONFIG, PLATFORM, ProcessRunnerService, THEME, type ShellModule } from '@choliba/core';

import { ProviderRegistry } from '../common';
import { ClaudeAgentProvider, CursorAgentProvider } from '../providers';
import { listAgentsCommand } from './agents-list.command';
import { runAgentCommand } from './agents-run.command';
import { AGENT_PROVIDERS, AGENTS } from './agents.constants';
import { AgentsService } from './agents.service';

/**
 * @choliba/agents in the shell: the providers (adding one is adding its class to the list), `choliba run agent` and
 * `choliba list agents`.
 */
export const agentsShell: ShellModule = {
  name: '@choliba/agents',
  provide: (container) => {
    container.provide(
      AGENT_PROVIDERS,
      () => new ProviderRegistry([new ClaudeAgentProvider(), new CursorAgentProvider()]),
    );
    container.provide(AGENTS, (c) => {
      const platform = c.get(PLATFORM);
      return new AgentsService(
        c.get(CONFIG),
        c.get(AGENT_PROVIDERS),
        new ProcessRunnerService({ spawner: platform.spawn }),
        c.get(THEME),
        platform,
      );
    });
  },
  commands: [runAgentCommand, listAgentsCommand],
};
