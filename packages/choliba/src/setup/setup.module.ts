import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { SetupCommand } from './setup.command';

@Module({
  imports: [ConfigModule, CliModule],
  providers: [SetupCommand],
})
export class SetupModule {}
