import { type CommandEntry, type CommandSpec, type ShellCommand } from '@choliba/core';
import { listProjectNames, listTicketSuffixes, TESTS, ticketsFolderPath } from '@choliba/runner';
import { projectLocations, projectsConfig } from '@choliba/workspace';

import { testsCliSpec } from './tests-spec';

function fromProjects(
  config: ReturnType<typeof projectsConfig.read>,
  read: (projectsDir: string) => readonly string[],
): readonly string[] {
  try {
    return read(projectLocations(config).CHOL_PROJECTS_DIR);
  } catch {
    return [];
  }
}

export function testsCommandSpec(config: ReturnType<typeof projectsConfig.read>): CommandSpec {
  return testsCliSpec(
    () => fromProjects(config, listProjectNames),
    (project) => fromProjects(config, (projectsDir) => listTicketSuffixes(ticketsFolderPath(projectsDir, project))),
  );
}

const ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'tests',
  description: 'Roda os testes E2E dos projetos com o Playwright',
  group: 'Commands',
};

export const testsCommand: ShellCommand = {
  verb: 'run',
  name: 'tests',
  help: (container) => [{ ...ENTRY, spec: testsCommandSpec(container.get(projectsConfig.token)) }],
  run: async (container, io) => {
    const args = io.args('run', 'tests');
    if (io.wantsHelp(args)) {
      io.printHelp(testsCommandSpec(container.get(projectsConfig.token)));
      return;
    }
    io.exit(await container.get(TESTS).run(args));
  },
};
