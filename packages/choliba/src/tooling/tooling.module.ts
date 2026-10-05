import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { FormatCommand, LintCommand, PlaywrightCliCommand, PlaywrightTraceCommand } from './tooling.commands';
import { ToolsService } from './tools.service';

/** `lint`, `format`, `playwright-cli` and `playwright-trace`: the tools choliba ships, run in the workspace. */
@Module({
  imports: [ConfigModule, CliModule],
  providers: [ToolsService, LintCommand, FormatCommand, PlaywrightCliCommand, PlaywrightTraceCommand],
})
export class ToolingModule {}
