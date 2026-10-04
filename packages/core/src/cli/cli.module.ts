import { Module } from '@nestjs/common';

import { CliHelpService } from './cli-help.service';

@Module({
  providers: [CliHelpService],
  exports: [CliHelpService],
})
export class CliModule {}
