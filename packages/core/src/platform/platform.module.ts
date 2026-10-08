import { Module, type DynamicModule } from '@nestjs/common';

import type { Platform } from './interfaces/platform.interface';
import { ExitStatus } from './exit-status.service';
import { ARGV, CLOCK, CWD, ENV, GIT, NO_COLOR_FLAG, SIGNALS, SPAWN, STDERR, STDOUT, WHICH } from './platform.constants';

const TOKENS = [ARGV, CWD, ENV, STDOUT, STDERR, CLOCK, SIGNALS, SPAWN, WHICH, GIT, NO_COLOR_FLAG] as const;

/**
 * The process and the runtime, as injectable values. Registered once by the app with what `main.ts`
 * reads from Bun and `process`, and global: it is the one module every other one needs, and the
 * values only exist at `forRoot`, so a module importing `PlatformModule` itself would get none.
 */
@Module({})
export class PlatformModule {
  static forRoot(platform: Platform): DynamicModule {
    const values: Readonly<Record<symbol, unknown>> = {
      [ARGV]: platform.argv,
      [CWD]: platform.cwd,
      [ENV]: platform.env,
      [STDOUT]: platform.stdout,
      [STDERR]: platform.stderr,
      [CLOCK]: platform.clock,
      [SIGNALS]: platform.signals,
      [SPAWN]: platform.spawn,
      [WHICH]: platform.which,
      [GIT]: platform.git,
      [NO_COLOR_FLAG]: platform.noColorFlag,
    };
    return {
      module: PlatformModule,
      global: true,
      providers: [...TOKENS.map((token) => ({ provide: token, useValue: values[token] })), ExitStatus],
      exports: [...TOKENS, ExitStatus],
    };
  }
}
