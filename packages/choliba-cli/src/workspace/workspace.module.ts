import { Module } from '@nestjs/common';

import { ConfigModule } from '@choliba/core/nest';

import { WorkspaceService } from './workspace.service';

/** The workspace's `choliba`, which runs what this one does not have. */
@Module({
  imports: [ConfigModule],
  providers: [WorkspaceService],
})
export class WorkspaceModule {}
