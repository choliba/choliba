import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf, type CommandEntry, type CommandSpec, type HelpContributor } from '@choliba/core';
import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { AgentsService } from './agents.service';

/** How `choliba --help` lists `agents` when the workspace's agents cannot be read. */
const ENTRY: CommandEntry = {
  name: 'agents',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/); `choliba <agente>` é atalho',
  group: 'Commands',
  spec: { usage: 'choliba agents COMMAND [OPTIONS] [TASK...]' },
};

/** `spec`'s agents, as the root help lists them: `choliba <agent>` shortcuts, not `--<agent>` flags. */
function agentShortcuts(spec: CommandSpec): readonly CommandEntry[] {
  try {
    return (spec.commands?.() ?? [])
      .filter((entry) => entry.group === 'Agents')
      .map((entry) => ({ ...entry, asFlag: false, listed: false }));
  } catch {
    return [];
  }
}

/** `choliba agents <agent> [OPTIONS] [TASK...]`, `agents list`, `agents --help`: its flags as typed. */
@RegisterHelp()
@Command({
  name: 'agents',
  description: 'Roda um agente da pasta de trabalho (.choliba/agents/<nome>/); `choliba <agente>` é atalho',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class AgentsCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(AgentsService) private readonly agents: AgentsService,
  ) {
    super();
  }

  /** `agents`, with the spec it builds from the workspace now, then the workspace's agents as shortcuts. */
  helpEntries(): readonly CommandEntry[] {
    let spec: CommandSpec;
    try {
      spec = this.agents.helpSpec();
    } catch {
      return [ENTRY];
    }
    return [{ ...ENTRY, spec }, ...agentShortcuts(spec)];
  }

  async run(): Promise<void> {
    try {
      this.io.exit(await this.agents.run(this.io.args('agents')));
    } catch (error) {
      this.io.fail(messageOf(error));
    }
  }
}
