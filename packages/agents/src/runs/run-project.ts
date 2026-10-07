import type { AgentDefinition } from '../agents/interfaces/agent.interface';

/** The project a run works on (`--project`): its name and its active environment's application. */
export interface RunProject {
  readonly name: string;
  readonly baseURL: string;
  /** The application's code, absolute. */
  readonly appDir: string;
}

/**
 * The project in words, for every agent that runs with one, whatever its `agent.yaml` says: where the
 * application is, and that `choliba tests` (or the person) prepares and starts it, never the agent. Without
 * this, agents that found it down started it themselves, and wrote servers and boot scripts to fake it.
 * Empty without a project.
 */
export function formatProject(project: RunProject | undefined): string {
  if (project === undefined) {
    return '';
  }
  const attr = (value: string): string => value.replaceAll('"', '&quot;');
  return [
    `<project name="${attr(project.name)}" baseURL="${attr(project.baseURL)}" appDir="${attr(project.appDir)}">`,
    'The application under test runs at its baseURL. `choliba tests` prepares it (config.json envs[].setup) and',
    'starts it when it is not up (envs[].start); otherwise the user starts it. Never start, stop or restart it',
    'yourself, never write a server, boot script or mock of it, and never change its installed dependencies',
    '(node_modules). If it does not respond or does not start, stop and report the message.',
    '</project>',
  ].join('\n');
}

/** Where the application's installed dependencies live: no agent writes or deletes there. */
function dependenciesDir(project: RunProject): string {
  return `${project.appDir.replace(/\/+$/, '')}/node_modules/`;
}

/**
 * The agent with its project's installed dependencies (`<appDir>/node_modules/`) denied to write and delete,
 * whatever it declares, so the rule `formatProject` states is also enforced. Unchanged without a project.
 */
export function withProjectDenies(agent: AgentDefinition, project: RunProject | undefined): AgentDefinition {
  if (project === undefined) {
    return agent;
  }
  const { permissions } = agent;
  const denied = dependenciesDir(project);
  return {
    ...agent,
    permissions: {
      ...permissions,
      denyWrite: [...permissions.denyWrite, denied],
      denyDelete: [...permissions.denyDelete, denied],
    },
  };
}
