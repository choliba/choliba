import { Module, type DynamicModule } from '@nestjs/common';

import { PlatformModule, RootModule, RuntimeModule } from '@choliba/core/nest';
import type { Platform } from '@choliba/core';

import { AddModule } from './add/nest';
import { GenerateModule } from './generate/nest';
import { CLI_ROOT, versionLine } from './help';
import { NewModule } from './new/nest';
import type { CliRuntime } from './runtime';
import { versionLines, WORKSPACE_GROUP } from './workspace';
import { WorkspaceModule } from './workspace/nest';

/** The machine's choliba (package choliba-cli), on the platform and runtime `main.ts` reads from Bun and the process. */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: CliRuntime): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(platform),
        RuntimeModule.forRoot(runtime),
        RootModule.forRoot({
          spec: CLI_ROOT,
          version: () => versionLines(versionLine(runtime.packageDir), runtime, platform.cwd),
          groups: ['Commands', WORKSPACE_GROUP],
        }),
        NewModule,
        GenerateModule,
        AddModule,
        WorkspaceModule,
      ],
    };
  }
}
