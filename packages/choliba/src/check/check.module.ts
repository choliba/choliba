import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { CheckCommand } from './check.command';

@Module({
  imports: [ConfigModule, CliModule],
  providers: [CheckCommand],
})
export class CheckModule {}
