import { Module, type DynamicModule } from '@nestjs/common';

import { PlatformModule, RuntimeModule } from '@choliba/core/nest';
import type { Platform } from '@choliba/core';

import { AgentModule } from './agent/agent.module';
import { HelpModule } from './help/help.module';
import { NewModule } from './new/new.module';
import type { CliRuntime } from './runtime/interfaces/runtime.interface';

/** The whole of choliba-cli, on the platform and runtime `main.ts` reads from Bun and the process. */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: CliRuntime): DynamicModule {
    return {
      module: AppModule,
      imports: [PlatformModule.forRoot(platform), RuntimeModule.forRoot(runtime), HelpModule, NewModule, AgentModule],
    };
  }
}
