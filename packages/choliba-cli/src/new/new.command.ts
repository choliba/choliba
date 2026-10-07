import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliCommand, CommandIo } from '@choliba/core/nest';

import { NEW_HELP } from './new.help';
import { parseNewOptions, UsageError, WorkspaceError } from './new-options';
import { formatSummary } from './new-workspace';
import { NewService } from './new.service';

/** `choliba-cli new [PASTA]`: a new workspace; exit 1 when a step fails or `choliba check` finds problems. */
@Command({
  name: 'new',
  description: 'Cria uma pasta de trabalho do choliba',
  allowUnknownOptions: true,
  allowExcessArgs: true,
})
export class NewCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(NewService) private readonly service: NewService,
  ) {
    super();
  }

  async run(): Promise<void> {
    const args = this.io.args('new');
    if (this.io.wantsHelp(args)) {
      this.io.printHelp(NEW_HELP);
      return;
    }
    try {
      const result = await this.service.create(parseNewOptions(args));
      this.io.write(formatSummary(result));
      this.io.exit(result.checked ? 0 : 1);
    } catch (error) {
      if (error instanceof UsageError) this.io.usageError(error.message, 'choliba-cli new');
      else if (error instanceof WorkspaceError) this.io.fail(`erro: ${error.message}`);
      else throw error;
    }
  }
}
