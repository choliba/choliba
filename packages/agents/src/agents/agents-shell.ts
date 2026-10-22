import { PLATFORM, ProcessRunnerService, THEME, WORKSPACE_ROOT, type ShellModule } from '@choliba/core';
import { projectsConfig } from '@choliba/projects';
import { sandboxConfig } from '@choliba/sandbox';

import { agentsConfig } from './agents-config';
import { knownProviders } from '../providers';
import { listAgentsCommand } from './agents-list.command';
import { runAgentCommand } from './agents-run.command';
import { AGENT_PROVIDERS, AGENTS } from './agents.constants';
import { AgentsService } from './agents.service';

/**
 * @choliba/agents in the shell: the providers (`knownProviders`), `choliba run agent`,
 * and `choliba list agents`.
 */
export const agentsShell: ShellModule = {
  name: '@choliba/agents',
  config: [agentsConfig, projectsConfig, sandboxConfig],
  provide: (container) => {
    container.provide(AGENT_PROVIDERS, () => knownProviders());
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
  commands: [runAgentCommand, listAgentsCommand],
};
