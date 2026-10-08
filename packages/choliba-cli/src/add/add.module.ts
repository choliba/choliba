import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { AddCommand } from './add.command';
import { AddService } from './add.service';

/** `choliba add`: installs agents, skills and MCPs; `choliba new` uses it for the agents it offers. */
@Module({
  imports: [CliModule, ConfigModule],
  providers: [AddCommand, AddService],
  exports: [AddService],
})
export class AddModule {}
