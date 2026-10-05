import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { runSubcommand } from '../projects/run-subcommand';
import { UsageError } from '../shared/errors';
import { parseCreateTicketArgs } from './dto/create-ticket.dto';
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

@SubCommand({ name: 'create-ticket', ...OPTIONS })
export class CreateTicketCommand extends CliCommand {
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
      'create-ticket',
      (args) => {
        const created = this.tickets.create(parseCreateTicketArgs(args));
        this.io.write(`Ticket "${created.ticket}" criado em ${created.path}. Troque os valores CHANGE_ME.\n`);
      },
    );
    return Promise.resolve();
  }
}
