import type { ShellIo } from '@choliba/core';

import { runSubcommand, UsageError } from '../common';
import type { ProjectsService } from './projects.service';

/** `choliba projects check PROJECT`. */
export function runProjectsCheck(io: ShellIo, projects: ProjectsService): void {
  runSubcommand(
    io,
    () => projects.helpSpec(),
    'check',
    ([project]) => {
      if (!project) throw new UsageError('Missing project for check.');
      const { config, environment } = projects.check(project);
      io.write(`Projeto "${project}" (${config.name}) pronto: ambiente ${environment.nome}, ${environment.baseURL}\n`);
    },
  );
}
