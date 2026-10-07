import { Module } from '@nestjs/common';

import { CliModule } from '@choliba/core/nest';

import { CholibaCliRootCommand } from './root.command';

@Module({
  imports: [CliModule],
  providers: [CholibaCliRootCommand],
})
export class HelpModule {}
