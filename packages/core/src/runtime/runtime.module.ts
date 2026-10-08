import { Module, type DynamicModule } from '@nestjs/common';

import { RUNTIME } from './runtime.constants';

/**
 * An app's runtime as an injectable value (`@Inject(RUNTIME)`), each app with its own type of it. Global for the
 * same reason as `PlatformModule`: the value only exists at `forRoot`, so importing the module itself would give an
 * empty one.
 */
@Module({})
export class RuntimeModule {
  static forRoot(runtime: unknown): DynamicModule {
    return {
      module: RuntimeModule,
      global: true,
      providers: [{ provide: RUNTIME, useValue: runtime }],
      exports: [RUNTIME],
    };
  }
}
