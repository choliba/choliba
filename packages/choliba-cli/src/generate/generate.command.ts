import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { GenerateAgentCommand } from './generate-agent.command';
import { GenerateProjectCommand } from './generate-project.command';
import { GenerateTicketCommand } from './generate-ticket.command';
import { generateHelp } from './generate-spec';
import { GenerateService } from './generate.service';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** `choliba generate` (or `g`): its help, or a usage error for a missing or unknown type. */
@RegisterHelp()
@Command({
  name: 'generate',
  aliases: ['g'],
  description: 'Gera um agente, um projeto ou um ticket',
  subCommands: [GenerateAgentCommand, GenerateProjectCommand, GenerateTicketCommand],
  ...OPTIONS,
})
export class GenerateCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(GenerateService) private readonly generate: GenerateService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [
      {
        name: 'generate',
        description: 'Gera um agente, um projeto de teste ou um ticket (alias: g)',
        aliases: ['g'],
        group: 'Commands',
        spec: generateHelp(this.generate.ticketTypes()),
      },
    ];
  }

  run(): Promise<void> {
    const [command] = this.io.args().slice(1);
    if (command === undefined || ['--help', '-h', 'help'].includes(command)) {
      this.io.printHelp(generateHelp(this.generate.ticketTypes()));
    } else {
      this.io.usageError(`tipo desconhecido: ${command}.`, 'choliba generate');
    }
    return Promise.resolve();
  }
}
