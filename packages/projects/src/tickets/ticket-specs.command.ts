import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { runSubcommand, UsageError } from '../common';
import { TicketsService } from './tickets.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'ticket-specs', ...OPTIONS })
export class TicketSpecsCommand extends CliCommand {
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
      'ticket-specs',
      ([project, ticket]) => {
        if (!project || !ticket) throw new UsageError('Missing project or ticket for ticket-specs.');
        for (const spec of this.tickets.specFiles(project, ticket)) {
          this.io.write(`${spec}\n`);
        }
      },
    );
    return Promise.resolve();
  }
}
