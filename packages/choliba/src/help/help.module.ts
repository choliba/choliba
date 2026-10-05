import { Module } from '@nestjs/common';

import { AgentsModule } from '@choliba/agents/nest';
import { CliModule } from '@choliba/core/nest';
import { ProjectsModule } from '@choliba/projects/nest';
import { TestsModule } from '@choliba/runner/nest';

import { AppHelpService } from './app-help.service';
import { CompleteCommand, DescribeCommand } from './complete.command';
import { CholibaRootCommand } from './root.command';

/** `choliba` itself: its help, the `choliba <agent>` shortcut, and completion of the whole command line. */
@Module({
  imports: [CliModule, AgentsModule, ProjectsModule, TestsModule],
  providers: [AppHelpService, CholibaRootCommand, CompleteCommand, DescribeCommand],
})
export class HelpModule {}
