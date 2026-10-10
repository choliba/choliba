import type { ShellIo } from '@choliba/core';

import { runSubcommand } from '../common';
import type { ProjectsService } from './projects.service';

/** `choliba projects report-folder [PROJECT] [TICKET]`. */
export function runReportFolder(io: ShellIo, projects: ProjectsService): void {
  runSubcommand(
    io,
    () => projects.helpSpec(),
    'report-folder',
    ([project, ticket]) => {
      io.write(`${projects.reportFolder(project, ticket)}\n`);
    },
  );
}
