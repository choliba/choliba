import { Module, type DynamicModule } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { CliModule } from './cli.module';
import { CompleteCommand } from './complete.command';
import { DescribeCommand } from './describe.command';
import { EntriesCommand } from './entries.command';
import type { RootOptions } from './interfaces/root.interface';
import { RootCommand } from './root.command';
import { ROOT_OPTIONS } from './root.constants';

/**
 * An app's root, owned by core: `<app>`, `--help`, `--version`, `__complete`, `__describe` and `__entries`, all built from the
 * commands that register their help (`@RegisterHelp()`). The app only says who it is.
 */
@Module({})
export class RootModule {
  static forRoot(options: RootOptions): DynamicModule {
    return {
      module: RootModule,
      imports: [CliModule, DiscoveryModule],
      providers: [
        { provide: ROOT_OPTIONS, useValue: options },
        RootCommand,
        CompleteCommand,
        DescribeCommand,
        EntriesCommand,
      ],
    };
  }
}
