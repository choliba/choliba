import { Module } from '@nestjs/common';

import { CliHelpService } from './cli-help.service';
import { CommandIo } from './command-io';

@Module({
  providers: [CliHelpService, CommandIo],
  exports: [CliHelpService, CommandIo],
})
export class CliModule {}
