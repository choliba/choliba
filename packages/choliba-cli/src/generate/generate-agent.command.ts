import { Inject } from '@nestjs/common';
import { SubCommand } from 'nest-commander';

import { messageOf } from '@choliba/core';
import { CliCommand, CommandIo } from '@choliba/core/nest';

import { UsageError, WorkspaceError } from '../common';
import { GENERATE_AGENT_HELP } from './generate-spec';
import { parseAgentNewOptions } from './agent-options';
import { AgentService } from './agent.service';
import { formatCreatedAgent } from './create-agent';
import { generateArgs } from './generate-args';

const OPTIONS = { allowUnknownOptions: true, allowExcessArgs: true } as const;

/** `choliba generate agent [NOME]`: a new agent; exit 1 when it cannot be made or `choliba check` finds problems. */
@SubCommand({ name: 'agent', ...OPTIONS })
export class GenerateAgentCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(AgentService) private readonly agents: AgentService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const args = generateArgs(this.io.args(), 'agent');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(GENERATE_AGENT_HELP);
      return;
    }
    try {
      const agent = await this.agents.create(parseAgentNewOptions(args));
      this.io.write(formatCreatedAgent(agent));
      this.io.exit(agent.checked ? 0 : 1);
    } catch (error) {
      if (error instanceof UsageError) this.io.usageError(error.message, 'choliba generate agent');
      else if (error instanceof WorkspaceError) this.io.fail(`erro: ${error.message}`);
      // Outside a workspace, the choliba's own message says so and how to find one.
      else this.io.fail(`erro: ${messageOf(error)}`);
    }
  }
}
