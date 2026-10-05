import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { LocationsModule } from '../locations/locations.module';
import { projectTemplatesDir } from '../tickets/ticket-template';
import { TicketsModule } from '../tickets/tickets.module';
import {
  CheckProjectCommand,
  CreateProjectCommand,
  ListProjectsCommand,
  ProjectsCommand,
  ReportFolderCommand,
} from './projects.command';
import { PROJECT_TEMPLATES_DIR } from './projects.constants';
import { ProjectsService } from './projects.service';

/** `choliba projects` and its commands; the tickets come with it. */
@Module({
  imports: [LocationsModule, TicketsModule, CliModule, ConfigModule],
  providers: [
    ProjectsService,
    { provide: PROJECT_TEMPLATES_DIR, useFactory: projectTemplatesDir },
    ProjectsCommand,
    ListProjectsCommand,
    CheckProjectCommand,
    ReportFolderCommand,
    CreateProjectCommand,
  ],
  exports: [ProjectsService, TicketsModule, LocationsModule],
})
export class ProjectsModule {}
