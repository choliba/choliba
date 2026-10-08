import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { entryHelp, messageOf, type CommandEntry, type HelpContributor } from '@choliba/core';
import { CliCommand, CommandIo, ConfigService, RegisterHelp } from '@choliba/core/nest';

import { allFine, checkWorkspace, formatCheck } from './check';

/** How `choliba --help` lists `check`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'check',
  description: 'Confere a pasta de trabalho: agentes (schemas, skills, MCPs) e projetos',
  group: 'Commands',
  spec: { usage: 'choliba check' },
};

/** `choliba check`: the agents (schemas, skills, MCPs) and the projects of the workspace; exit 1 when any is wrong. */
@RegisterHelp()
@Command({
  name: 'check',
  description: 'Confere a pasta de trabalho',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class CheckCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  run(): Promise<void> {
    if (this.io.wantsHelp(this.io.args('check'))) {
      this.io.printHelp(entryHelp(ENTRY));
      return Promise.resolve();
    }
    try {
      const root = this.config.workspaceRoot();
      const sections = checkWorkspace(root, this.config.load(root));
      this.io.write(`${formatCheck(sections)}\n`);
      this.io.exit(allFine(sections) ? 0 : 1);
    } catch (error) {
      this.io.fail(messageOf(error));
    }
    return Promise.resolve();
  }
}
