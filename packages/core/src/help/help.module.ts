import { Module } from '@nestjs/common';

import { CliHelpService } from './cli-help.service';

/** What every command prints from its `CommandSpec`: its help, its completions and its one-line summary. */
@Module({
  providers: [CliHelpService],
  exports: [CliHelpService],
})
export class HelpModule {}
