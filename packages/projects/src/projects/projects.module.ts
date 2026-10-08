import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { LocationsModule } from '../locations/nest';
import { projectTemplatesDir } from '../tickets';
import { TicketsModule } from '../tickets/nest';
import { CheckProjectCommand } from './check-project.command';
import { CreateProjectCommand } from './create-project.command';
import { CreateTicketCommand } from './create-ticket.command';
import { ListProjectsCommand } from './list-projects.command';
import { ProjectsCommand } from './projects.command';
import { ReportFolderCommand } from './report-folder.command';
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
    CreateTicketCommand,
  ],
  exports: [ProjectsService, TicketsModule, LocationsModule],
})
export class ProjectsModule {}
