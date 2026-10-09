import { Module } from '@nestjs/common';

import { ConfigModule } from '@choliba/core/nest';

import { WorkspaceHelp, WorkspaceService } from './workspace.service';

/** The workspace's `choliba`, which runs what this one does not have and lists it in the help. */
@Module({
  imports: [ConfigModule],
  providers: [WorkspaceService, WorkspaceHelp],
})
export class WorkspaceModule {}
