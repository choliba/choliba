import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';
import { LocationsModule } from '@choliba/projects/nest';

import { AgentService } from './agent.service';
import { GenerateAgentCommand } from './generate-agent.command';
import { GenerateProjectCommand } from './generate-project.command';
import { GenerateTicketCommand } from './generate-ticket.command';
import { GenerateCommand } from './generate.command';
import { GenerateService } from './generate.service';

/** `choliba generate` (or `g`): an agent, a test project or a ticket, in the workspace. */
@Module({
  imports: [CliModule, ConfigModule, LocationsModule],
  providers: [
    GenerateCommand,
    GenerateAgentCommand,
    GenerateProjectCommand,
    GenerateTicketCommand,
    AgentService,
    GenerateService,
  ],
})
export class GenerateModule {}
