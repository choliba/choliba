import { Module, type DynamicModule } from '@nestjs/common';

import { PlatformModule } from '@choliba/core/nest';
import type { Platform } from '@choliba/core/platform';

import { HelpModule } from './help/help.module';
import { NewModule } from './new/new.module';
import type { CliRuntime } from './runtime/interfaces/runtime.interface';
import { RuntimeModule } from './runtime/runtime.module';

/** The whole of choliba-cli, on the platform and runtime `main.ts` reads from Bun and the process. */
@Module({})
export class AppModule {
  static forRoot(platform: Platform, runtime: CliRuntime): DynamicModule {
    return {
      module: AppModule,
      imports: [PlatformModule.forRoot(platform), RuntimeModule.forRoot(runtime), HelpModule, NewModule],
    };
  }
}
