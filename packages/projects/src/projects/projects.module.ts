import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { LocationsModule } from '../locations/nest';
import { TicketsModule } from '../tickets/nest';
import { ProjectsCheckCommand } from './projects-check.command';
import { ProjectsListCommand } from './projects-list.command';
import { ProjectsCommand } from './projects.command';
import { ReportFolderCommand } from './report-folder.command';
import { ProjectsService } from './projects.service';

/** `choliba projects` and its commands; the tickets come with it. */
@Module({
  imports: [LocationsModule, TicketsModule, CliModule, ConfigModule],
  providers: [ProjectsService, ProjectsCommand, ProjectsListCommand, ProjectsCheckCommand, ReportFolderCommand],
  exports: [ProjectsService, TicketsModule, LocationsModule],
})
export class ProjectsModule {}
