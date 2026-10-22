import { PLATFORM, ProcessRunnerService, THEME, WORKSPACE_ROOT, type ShellModule } from '@choliba/core';
import { projectsConfig } from '@choliba/projects';
import { sandboxConfig } from '@choliba/sandbox';

import { agentsConfig } from './agents-config';
import { AGENT_PROVIDERS, AGENTS } from './agents.constants';
import { AgentsService } from './agents.service';

/**
 * @choliba/agents' configuration and service registrations. The app owns the CLI commands and registers the providers
 * (`AGENT_PROVIDERS`).
 */
export const agentsShell: ShellModule = {
  name: '@choliba/agents',
  config: [agentsConfig, projectsConfig, sandboxConfig],
  provide: (container) => {
    container.provide(AGENTS, (c) => {
      const platform = c.get(PLATFORM);
      const agents = c.get(agentsConfig.token);
      const projects = c.get(projectsConfig.token);
      const sandbox = c.get(sandboxConfig.token);
      const config = {
        ...platform.env,
        CHOL_AGENTS_PROVIDER: agents.provider,
        CHOL_OLLAMA_URL: agents.ollamaUrl,
        CHOL_PLAYWRIGHT_MCP_OUTPUT_DIR: agents.playwrightOutputDir,
        CHOL_AGENTS_DIR: agents.agentsDir,
        CHOL_SKILLS_DIR: agents.skillsDir,
        CHOL_MCPS_DIR: agents.mcpsDir,
        CLAUDE_CODE_OAUTH_TOKEN: agents.claudeCodeOauthToken,
        CURSOR_API_KEY: agents.cursorApiKey,
        CHOL_GLOBAL_DIR: projects.globalDir,
        CHOL_PROJECTS_DIR: projects.projectsDir,
        CHOL_TICKET_RUNS: projects.ticketRuns,
        CHOL_SANDBOX: sandbox.mode,
        CHOL_SANDBOX_IMAGE: sandbox.image,
        CHOL_NETWORK: sandbox.network,
      };
      return new AgentsService(
        () => c.get(WORKSPACE_ROOT),
        config,
        c.get(AGENT_PROVIDERS),
        new ProcessRunnerService({ spawner: platform.spawn }),
        c.get(THEME),
        platform,
      );
    });
  },
  commands: [],
};
