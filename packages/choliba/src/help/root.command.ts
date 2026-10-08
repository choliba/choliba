import { Inject } from '@nestjs/common';
import { RootCommand } from 'nest-commander';

import { messageOf, versionLine } from '@choliba/core';
import { CliCommand, CommandIo } from '@choliba/core/nest';
import { AgentsService } from '@choliba/agents/nest';

import { CHOLIBA_HELP } from './app.help';

import { cholibaManifest, PACKAGE_NAME } from './version';

const HELP_WORDS: readonly string[] = ['help', '--help', '-h'];

/**
 * `choliba` with no command, or with `help`/`--help`/`-h`: the help; `choliba --version`: the version. Any other
 * first word that is not a command is an agent of the workspace: `choliba <agent> …` is `choliba agents <agent> …`.
 */
@RootCommand({ arguments: '[words...]', allowUnknownOptions: true, allowExcessArgs: true })
export class CholibaRootCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(AgentsService) private readonly agents: AgentsService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const argv = this.io.args();
    const [first] = argv;
    if (first === undefined || HELP_WORDS.includes(first)) {
      this.io.printHelp(CHOLIBA_HELP);
      return;
    }
    if (first === '--version') {
      this.io.write(`${versionLine(PACKAGE_NAME, cholibaManifest())}\n`);
      return;
    }
    try {
      this.io.exit(await this.agents.run(argv));
    } catch (error) {
      this.io.fail(messageOf(error));
    }
  }
}
