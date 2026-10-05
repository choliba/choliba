import { Module } from '@nestjs/common';

import { CliModule } from '@choliba/core/nest';

import { LocationsModule } from '../locations/locations.module';
import { CreateTicketCommand, TicketSpecsCommand, TicketsFolderCommand } from './tickets.command';
import { TicketsService } from './tickets.service';

@Module({
  imports: [LocationsModule, CliModule],
  providers: [TicketsService, TicketsFolderCommand, TicketSpecsCommand, CreateTicketCommand],
  exports: [TicketsService],
})
export class TicketsModule {}
