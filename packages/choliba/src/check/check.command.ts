import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { messageOf } from '@choliba/core/cli';
import { CliCommand, CommandIo, ConfigService } from '@choliba/core/nest';

import { commandHelp } from '../help/app.help';
import { allFine, checkWorkspace, formatCheck } from './check';

/** `choliba check`: the agents (schemas, skills, MCPs) and the projects of the workspace; exit 1 when any is wrong. */
@Command({
  name: 'check',
  description: 'Confere a pasta de trabalho',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class CheckCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    super();
  }

  run(): Promise<void> {
    if (this.io.wantsHelp(this.io.args('check'))) {
      this.io.printHelp(commandHelp('check'));
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
