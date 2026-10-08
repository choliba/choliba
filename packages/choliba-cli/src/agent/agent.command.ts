import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { AgentNewCommand } from './agent-new.command';
import { AGENT_HELP } from './agent-spec';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** How `choliba-cli --help` lists `agent`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'agent',
  description: 'Cria um agente novo na pasta de trabalho (agent new)',
  group: 'Commands',
  spec: AGENT_HELP,
};

/** `choliba-cli agent`: its help, or a usage error for a missing or unknown command. */
@RegisterHelp()
@Command({ name: 'agent', description: 'Agentes da pasta de trabalho', subCommands: [AgentNewCommand], ...OPTIONS })
export class AgentCommand extends CliCommand implements HelpContributor {
  constructor(@Inject(CommandIo) private readonly io: CommandIo) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  run(): Promise<void> {
    const [command] = this.io.args('agent');
    if (command === undefined || ['--help', '-h', 'help'].includes(command)) this.io.printHelp(AGENT_HELP);
    else this.io.usageError(`comando desconhecido: agent ${command}.`, 'choliba-cli agent');
    return Promise.resolve();
  }
}
