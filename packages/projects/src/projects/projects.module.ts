import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { LocationsModule } from '../locations/nest';
import { TicketsModule } from '../tickets/nest';
import { CheckProjectCommand } from './check-project.command';
import { ListProjectsCommand } from './list-projects.command';
import { ProjectsCommand } from './projects.command';
import { ReportFolderCommand } from './report-folder.command';
import { ProjectsService } from './projects.service';

/** `choliba projects` and its commands; the tickets come with it. */
@Module({
  imports: [LocationsModule, TicketsModule, CliModule, ConfigModule],
  providers: [ProjectsService, ProjectsCommand, ListProjectsCommand, CheckProjectCommand, ReportFolderCommand],
  exports: [ProjectsService, TicketsModule, LocationsModule],
})
export class ProjectsModule {}
