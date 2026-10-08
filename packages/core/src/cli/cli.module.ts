import { Module } from '@nestjs/common';

import { HelpModule } from '../help/nest';
import { CommandIo } from './command-io.service';

/** The base every command injects: its input and output (`CommandIo`), and the help it prints (`HelpModule`). */
@Module({
  imports: [HelpModule],
  providers: [CommandIo],
  exports: [HelpModule, CommandIo],
})
export class CliModule {}
