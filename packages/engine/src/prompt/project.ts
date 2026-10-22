import type { RunPlace } from '@choliba/domain';

/**
 * The project in words, for every agent that runs with one, whatever its `agent.yaml` says: where the
 * application is, and that choliba prepares it and keeps it up for the run (`ensureApp`), never the agent. Without
 * this, agents that found it down started it themselves, and wrote servers and boot scripts to fake it.
 * Empty without a project.
 */
export function formatProject(project: RunPlace['project']): string {
  if (project === undefined) {
    return '';
  }
  const attr = (value: string): string => value.replaceAll('"', '&quot;');
  const translated =
    project.agentBaseURL === project.baseURL
      ? []
      : [
          `config.json gives ${project.baseURL}, the address as the machine running choliba sees it; from where you run,`,
          'the application is at the baseURL above. Use it.',
        ];
  return [
    `<project name="${attr(project.name)}" baseURL="${attr(project.agentBaseURL)}" appDir="${attr(project.appDir)}">`,
    ...translated,
    'The application under test runs at its baseURL. choliba prepared it (config.json envs[].setup) and made sure',
    'it is up before this run (envs[].start when it was not); it stays up until the run ends. Never start, stop or',
    'restart it yourself, never write a server, boot script or mock of it, and never change its installed',
    'dependencies (node_modules). If it does not respond, stop and report the message.',
    '</project>',
  ].join('\n');
}
