import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { FormatCommand } from './format.command';
import { LintCommand } from './lint.command';
import { ToolsService } from './tools.service';

/** `lint` and `format`: the tools choliba ships, run in the workspace. */
@Module({
  imports: [ConfigModule, CliModule],
  providers: [ToolsService, LintCommand, FormatCommand],
})
export class ToolingModule {}
