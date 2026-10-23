import { formatRows, messageOf, type CommandEntry, type ShellCommand, type ShellIo } from '@choliba/shell';
import { PROJECTS, type ProjectsService } from '@choliba/tui';

import { listProjectsSpec } from './projects-spec';

function runProjectsList(io: ShellIo, projects: ProjectsService): void {
  const args = io.args('list', 'projects');
  if (io.wantsHelp(args)) {
    io.printHelp(listProjectsSpec());
    return;
  }
  try {
    const found = projects.list();
    if (found.length === 0) {
      io.write(`Nenhum projeto encontrado em ${projects.projectsDir()}.\n`);
      return;
    }
    if (args.includes('--tickets')) {
      for (const { name, tickets } of projects.listWithTickets()) io.write(`${name} ${JSON.stringify(tickets)}\n`);
      return;
    }
    io.write(`${formatRows(found.map(({ name, description }) => [name, description]))}\n`);
  } catch (error) {
    io.fail(messageOf(error));
  }
}

const LIST_ENTRY: CommandEntry = {
  name: 'projects',
  description: 'Lista os projetos de CHOL_PROJECTS_DIR',
  group: 'Commands',
  spec: listProjectsSpec(),
};

export const listProjectsCommand: ShellCommand = {
  verb: 'list',
  name: 'projects',
  help: () => [LIST_ENTRY],
  run: (container, io) => {
    runProjectsList(io, container.get(PROJECTS));
    return Promise.resolve();
  },
};
