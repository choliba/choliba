import { Module } from '@nestjs/common';

import { CliModule } from '@choliba/core/nest';

import { LocationsModule } from '../locations/nest';
import { TicketSpecsCommand } from './ticket-specs.command';
import { TicketsFolderCommand } from './tickets-folder.command';
import { TicketsService } from './tickets.service';

@Module({
  imports: [LocationsModule, CliModule],
  providers: [TicketsService, TicketsFolderCommand, TicketSpecsCommand],
  exports: [TicketsService],
})
export class TicketsModule {}
