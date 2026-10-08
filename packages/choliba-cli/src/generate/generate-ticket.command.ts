import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { messageOf } from '@choliba/core';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { UsageError } from '../common';
import { parseGenerateTicketArgs } from './dto/generate-ticket.dto';
import { generateArgs } from './generate-args';
import { generateTicketHelp } from './generate-spec';
import { GenerateService } from './generate.service';

/** `choliba generate ticket PROJECT TYPE`: a ticket from the type's template, in the project's active environment. */
@SubCommand({ name: 'ticket', allowUnknownOptions: true, allowExcessArgs: true })
export class GenerateTicketCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(GenerateService) private readonly generate: GenerateService,
  ) {
    super();
  }

  run(): Promise<void> {
    const args = generateArgs(this.io.args(), 'ticket');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(generateTicketHelp(this.generate.ticketTypes()));
      return Promise.resolve();
    }
    try {
      const created = this.generate.ticket(parseGenerateTicketArgs(args));
      this.io.write(`Ticket "${created.ticket}" criado em ${created.path}. Troque os valores CHANGE_ME.\n`);
    } catch (error) {
      if (error instanceof UsageError) this.io.usageError(error.message, 'choliba generate ticket');
      else this.io.fail(messageOf(error));
    }
    return Promise.resolve();
  }
}
