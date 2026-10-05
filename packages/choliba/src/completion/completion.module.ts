import { Module } from '@nestjs/common';

import { CliModule } from '@choliba/core/nest';

import { CompletionCommand } from './completion.command';

@Module({
  imports: [CliModule],
  providers: [CompletionCommand],
})
export class CompletionModule {}
