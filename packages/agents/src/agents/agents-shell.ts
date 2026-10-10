import { CONFIG, PLATFORM, THEME, type ShellModule } from '@choliba/core';
import { ProcessRunnerService } from '@choliba/terminal';

import { ProviderRegistry } from '../common';
import { ClaudeAgentProvider, CursorAgentProvider } from '../providers';
import { agentsCommand } from './agents.command';
import { AGENT_PROVIDERS, AGENTS } from './agents.constants';
import { AgentsService } from './agents.service';

/**
 * @choliba/agents in the shell: the providers (adding one is adding its class to the list), `choliba agents`, and
 * `choliba <agent> …`, a first word that is no command, which runs as `choliba agents <agent> …`.
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
  commands: [agentsCommand],
  fallback: async (container, io) => {
    io.exit(await container.get(AGENTS).run(io.args()));
  },
};
