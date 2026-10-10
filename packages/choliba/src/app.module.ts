import { Module, type DynamicModule } from '@nestjs/common';

import { PlatformModule, RootModule, RuntimeModule } from '@choliba/core/nest';
import { versionLine, type Platform, type Shell } from '@choliba/core';
import { ProjectsModule } from '@choliba/projects/nest';
import { TerminalModule } from '@choliba/terminal/nest';

import { CHOLIBA_ORDER, CHOLIBA_ROOT } from './help';
import { cholibaManifest, PACKAGE_NAME } from './help';
import type { Runtime } from './runtime';
import { ToolingModule } from './tooling/nest';

/**
 * The commands of choliba still on Nest, on the platform and runtime `main.ts` reads from Bun and the process. The root
 * help also lists the commands already in `shell`, so `choliba --help` shows them all, and hands a first word that is no
 * command (`choliba <agent> …`) to the shell's fallback.
 */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: Runtime, shell: Shell): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PlatformModule.forRoot(platform),
        RuntimeModule.forRoot(runtime),
        RootModule.forRoot({
          spec: CHOLIBA_ROOT,
          version: () => versionLine(PACKAGE_NAME, cholibaManifest()),
          groups: ['Commands', 'Agents'],
          order: CHOLIBA_ORDER,
          entries: () => shell.entries(),
          fallback: shell.fallback,
        }),
        ProjectsModule,
        TerminalModule,
        ToolingModule,
      ],
    };
  }
}
