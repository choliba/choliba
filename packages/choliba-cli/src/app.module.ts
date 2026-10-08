import { Module, type DynamicModule } from '@nestjs/common';

import { PlatformModule, RootModule, RuntimeModule } from '@choliba/core/nest';
import type { Platform } from '@choliba/core';

import { AgentModule } from './agent/nest';
import { CLI_ROOT } from './help';
import { versionLine } from './help';
import { NewModule } from './new/nest';
import type { CliRuntime } from './runtime';

/** The whole of choliba-cli, on the platform and runtime `main.ts` reads from Bun and the process. */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: CliRuntime): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(platform),
        RuntimeModule.forRoot(runtime),
        RootModule.forRoot({ spec: CLI_ROOT, version: () => versionLine(runtime.packageDir), groups: ['Commands'] }),
        NewModule,
        AgentModule,
      ],
    };
  }
}
