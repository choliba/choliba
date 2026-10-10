import { CONFIG, PLATFORM, type CommandEntry, type Container, type ShellCommand, type ShellIo } from '@choliba/core';

import { PROGRAM_NAME } from '../common';
import { runTicketSpecs, runTicketsFolder } from '../tickets';
import { PROJECTS, TICKETS } from './projects.constants';
import { runProjectsCheck } from './projects-check.command';
import { runProjectsList } from './projects-list.command';
import { runProjectsNew } from './projects-new.command';
import { runReportFolder } from './report-folder.command';

/** How `choliba --help` lists `projects`; its spec is built from the workspace when asked for. */
const ENTRY: Omit<CommandEntry, 'spec'> = {
  name: 'projects',
  description: 'Cria, lista e confere projetos e tickets em CHOL_PROJECTS_DIR',
  group: 'Commands',
};

const COMMANDS: Record<string, (io: ShellIo, container: Container) => void | Promise<void>> = {
  list: (io, container) => {
    runProjectsList(io, container.get(PROJECTS));
  },
  new: (io, container) =>
    runProjectsNew(io, container.get(PROJECTS), container.get(CONFIG).startDir(), container.get(PLATFORM).ask),
  check: (io, container) => {
    runProjectsCheck(io, container.get(PROJECTS));
  },
  'report-folder': (io, container) => {
    runReportFolder(io, container.get(PROJECTS));
  },
  'tickets-folder': (io, container) => {
    runTicketsFolder(io, container.get(TICKETS));
  },
  'ticket-specs': (io, container) => {
    runTicketSpecs(io, container.get(TICKETS));
  },
};

/** `choliba projects`: its help, or what is wrong when no known command follows. */
export const projectsCommand: ShellCommand = {
  name: 'projects',
  help: (container) => [{ ...ENTRY, spec: container.get(PROJECTS).helpSpec() }],
  async run(container, io) {
    const [command] = io.args('projects');
    if (command === undefined) {
      io.usageError('Missing command.', PROGRAM_NAME);
      return;
    }
    if (command === '--help' || command === '-h' || command === 'help') {
      io.printHelp(container.get(PROJECTS).helpSpec());
      return;
    }
    const runCommand = COMMANDS[command];
    if (runCommand === undefined) {
      io.usageError(`Unknown command "${command}".`, PROGRAM_NAME);
      return;
    }
    await runCommand(io, container);
  },
};
