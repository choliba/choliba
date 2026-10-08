import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { parseCreateTicketArgs } from './dto/create-ticket.dto';
import { runSubcommand } from '../common';
import { TicketsService } from '../tickets/nest';
import { ProjectsService } from './projects.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

@SubCommand({ name: 'create-ticket', ...OPTIONS })
export class CreateTicketCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(TicketsService) private readonly tickets: TicketsService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {
    super();
  }

  async run(): Promise<void> {
    runSubcommand(
      this.io,
      () => this.projects.helpSpec(),
      'create-ticket',
      (args) => {
        const { project, type } = parseCreateTicketArgs(args);
        const created = this.tickets.create(project, type, this.projects.check(project).environment.nome);
        this.io.write(`Ticket "${created.ticket}" criado em ${created.path}. Troque os valores CHANGE_ME.\n`);
      },
    );
    return Promise.resolve();
  }
}
