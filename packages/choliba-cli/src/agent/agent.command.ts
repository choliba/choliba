import { Inject } from '@nestjs/common';
import { Command, SubCommand } from 'nest-commander';

import { messageOf } from '@choliba/core/cli';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { UsageError, WorkspaceError } from '../new/new-options';
import { AGENT_HELP, AGENT_NEW_HELP } from './agent.help';
import { parseAgentNewOptions } from './agent-options';
import { AgentService } from './agent.service';
import { formatCreatedAgent } from './create-agent';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** `choliba-cli agent new [NOME]`: a new agent; exit 1 when it cannot be made or `choliba check` finds problems. */
@SubCommand({ name: 'new', ...OPTIONS })
export class AgentNewCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(AgentService) private readonly agents: AgentService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const args = this.io.args('agent', 'new');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(AGENT_NEW_HELP);
      return;
    }
    try {
      const agent = await this.agents.create(parseAgentNewOptions(args));
      this.io.write(formatCreatedAgent(agent));
      this.io.exit(agent.checked ? 0 : 1);
    } catch (error) {
      if (error instanceof UsageError) this.io.usageError(error.message, 'choliba-cli agent new');
      else if (error instanceof WorkspaceError) this.io.fail(`erro: ${error.message}`);
      // Outside a workspace, the choliba's own message says so and how to find one.
      else this.io.fail(`erro: ${messageOf(error)}`);
    }
  }
}

/** `choliba-cli agent`: its help, or a usage error for a missing or unknown command. */
@Command({ name: 'agent', description: 'Agentes da pasta de trabalho', subCommands: [AgentNewCommand], ...OPTIONS })
export class AgentCommand extends CliCommand {
  constructor(@Inject(CommandIo) private readonly io: CommandIo) {
    super();
  }

  run(): Promise<void> {
    const [command] = this.io.args('agent');
    if (command === undefined || ['--help', '-h', 'help'].includes(command)) this.io.printHelp(AGENT_HELP);
    else this.io.usageError(`comando desconhecido: agent ${command}.`, 'choliba-cli agent');
    return Promise.resolve();
  }
}
