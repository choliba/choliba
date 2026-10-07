import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { AgentCommand, AgentNewCommand } from './agent.command';
import { AgentService } from './agent.service';

@Module({
  imports: [CliModule, ConfigModule],
  providers: [AgentCommand, AgentNewCommand, AgentService],
})
export class AgentModule {}
