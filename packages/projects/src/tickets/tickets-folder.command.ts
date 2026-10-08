import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { runSubcommand, UsageError } from '../common';
import { TicketsService } from './tickets.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'tickets-folder', ...OPTIONS })
export class TicketsFolderCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(TicketsService) private readonly tickets: TicketsService,
  ) {
    super();
  }

  async run(): Promise<void> {
    runSubcommand(
      this.io,
      () => this.tickets.helpSpec(),
      'tickets-folder',
      ([project]) => {
        if (!project) throw new UsageError('Missing project for tickets-folder.');
        this.io.write(`${this.tickets.folder(project)}\n`);
      },
    );
    return Promise.resolve();
  }
}
