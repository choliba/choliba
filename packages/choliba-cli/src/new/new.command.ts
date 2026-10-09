import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import type { CommandEntry, HelpContributor } from '@choliba/core';

import { CliCommand, CommandIo, RegisterHelp } from '@choliba/core/nest';

import { NEW_HELP } from './new-spec';
import { parseNewOptions } from './new-options';
import { UsageError, WorkspaceError } from '../common';
import { formatSummary } from './new-workspace';
import { NewService } from './new.service';

/** How `choliba --help` lists `new`, and its own `--help`. */
const ENTRY: CommandEntry = {
  name: 'new',
  description: 'Cria uma pasta de trabalho do choliba (alias: n)',
  aliases: ['n'],
  group: 'Commands',
  spec: NEW_HELP,
};

/** `choliba new [PASTA]`: a new workspace; exit 1 when a step fails or `choliba check` finds problems. */
@RegisterHelp()
@Command({
  aliases: ['n'],
  name: 'new',
  description: 'Cria uma pasta de trabalho do choliba (alias: n)',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class NewCommand extends CliCommand implements HelpContributor {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(NewService) private readonly service: NewService,
  ) {
    super();
  }

  helpEntries(): readonly CommandEntry[] {
    return [ENTRY];
  }

  async run(): Promise<void> {
    const [, ...args] = this.io.args();
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(NEW_HELP);
      return;
    }
    try {
      const result = await this.service.create(parseNewOptions(args));
      this.io.write(formatSummary(result));
      this.io.exit(result.checked ? 0 : 1);
    } catch (error) {
      if (error instanceof UsageError) this.io.usageError(error.message, 'choliba new');
      else if (error instanceof WorkspaceError) this.io.fail(`erro: ${error.message}`);
      else throw error;
    }
  }
}
