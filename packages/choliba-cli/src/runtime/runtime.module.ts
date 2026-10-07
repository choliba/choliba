import { Module, type DynamicModule } from '@nestjs/common';

import type { CliRuntime } from './interfaces/runtime.interface';
import { RUNTIME } from './runtime.constants';

/** The `CliRuntime` as an injectable value, global for the same reason as `PlatformModule`: it only exists at `forRoot`. */
@Module({})
export class RuntimeModule {
  static forRoot(runtime: CliRuntime): DynamicModule {
    return {
      module: RuntimeModule,
      global: true,
      providers: [{ provide: RUNTIME, useValue: runtime }],
      exports: [RUNTIME],
    };
  }
}
