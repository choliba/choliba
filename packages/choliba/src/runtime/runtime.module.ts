import { Module, type DynamicModule } from '@nestjs/common';

import type { Runtime } from './interfaces/runtime.interface';
import { RUNTIME } from './runtime.constants';

/** The `Runtime` as an injectable value, global for the same reason as `PlatformModule`. */
@Module({})
export class RuntimeModule {
  static forRoot(runtime: Runtime): DynamicModule {
    return {
      module: RuntimeModule,
      global: true,
      providers: [{ provide: RUNTIME, useValue: runtime }],
      exports: [RUNTIME],
    };
  }
}
