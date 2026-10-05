import { Module } from '@nestjs/common';

import { CliModule, ConfigModule, ThemeModule } from '@choliba/core/nest';
import { TerminalModule } from '@choliba/terminal/nest';

import { ClaudeProviderModule } from '../providers/claude/claude-provider.module';
import { CursorProviderModule } from '../providers/cursor/cursor-provider.module';
import { ProvidersModule } from '../providers/providers.module';
import { AgentsCommand } from './agents.command';
import { AgentsService } from './agents.service';

/** `choliba agents` and the providers it runs agents through: one module per provider. */
@Module({
  imports: [
    ConfigModule,
    CliModule,
    ThemeModule,
    TerminalModule,
    ProvidersModule,
    ClaudeProviderModule,
    CursorProviderModule,
  ],
  providers: [AgentsService, AgentsCommand],
  exports: [AgentsService],
})
export class AgentsModule {}
