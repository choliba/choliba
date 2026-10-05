import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf } from '@choliba/core/cli';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { AgentsService } from './agents.service';

/** `choliba agents <agent> [OPTIONS] [TASK...]`, `agents list`, `agents --help`: its flags as typed. */
@Command({
  name: 'agents',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/); `choliba <agente>` é atalho',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class AgentsCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(AgentsService) private readonly agents: AgentsService,
  ) {
    super();
  }

  async run(): Promise<void> {
    try {
      this.io.exit(await this.agents.run(this.io.args('agents')));
    } catch (error) {
      this.io.fail(messageOf(error));
    }
  }
}
