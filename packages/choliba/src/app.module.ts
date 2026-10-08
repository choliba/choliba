import { Module, type DynamicModule } from '@nestjs/common';

import { AgentsModule } from '@choliba/agents/nest';
import { PlatformModule, RuntimeModule } from '@choliba/core/nest';
import type { Platform } from '@choliba/core';
import { ProjectsModule } from '@choliba/projects/nest';
import { TestsModule } from '@choliba/runner/nest';
import { TerminalModule } from '@choliba/terminal/nest';

import { CheckModule } from './check/check.module';
import { CompletionModule } from './completion/completion.module';
import { HelpModule } from './help/help.module';
import { InstallModule } from './install/install.module';
import type { Runtime } from './runtime/interfaces/runtime.interface';
import { SetupModule } from './setup/setup.module';
import { ToolingModule } from './tooling/tooling.module';

/** The whole of choliba: every command, on the platform and runtime `main.ts` reads from Bun and the process. */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: Runtime): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(platform),
        RuntimeModule.forRoot(runtime),
        HelpModule,
        AgentsModule,
        ProjectsModule,
        TestsModule,
        TerminalModule,
        InstallModule,
        CheckModule,
        ToolingModule,
        SetupModule,
        CompletionModule,
      ],
    };
  }
}
