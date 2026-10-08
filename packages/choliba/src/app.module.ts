import { Module, type DynamicModule } from '@nestjs/common';

import { AgentsModule } from '@choliba/agents/nest';
import { PlatformModule, RootModule, RuntimeModule } from '@choliba/core/nest';
import { versionLine, type Platform } from '@choliba/core';
import { ProjectsModule } from '@choliba/projects/nest';
import { TestsModule } from '@choliba/runner/nest';
import { TerminalModule } from '@choliba/terminal/nest';

import { CheckModule } from './check/nest';
import { CompletionModule } from './completion/nest';
import { CHOLIBA_ROOT } from './help';
import { cholibaManifest, PACKAGE_NAME } from './help';
import { InstallModule } from './install/nest';
import type { Runtime } from './runtime';
import { SetupModule } from './setup/nest';
import { ToolingModule } from './tooling/nest';

/** The whole of choliba: every command, on the platform and runtime `main.ts` reads from Bun and the process. */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: Runtime): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(platform),
        RuntimeModule.forRoot(runtime),
        RootModule.forRoot({
          spec: CHOLIBA_ROOT,
          version: () => versionLine(PACKAGE_NAME, cholibaManifest()),
          groups: ['Commands', 'Agents'],
        }),
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
