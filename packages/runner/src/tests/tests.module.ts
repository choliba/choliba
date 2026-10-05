import { Module } from '@nestjs/common';

import { CliModule, ConfigModule, ThemeModule } from '@choliba/core/nest';
import { LocationsModule } from '@choliba/projects/nest';

import { findRunnerRoot } from './runner-root';
import { RUNNER_ROOT, TESTS_HOOKS, type TestsHooks } from './tests.constants';
import { TestsCommand } from './tests.command';
import { TestsService } from './tests.service';

const NO_HOOKS: TestsHooks = {};

@Module({
  imports: [ConfigModule, CliModule, LocationsModule, ThemeModule],
  providers: [
    TestsService,
    TestsCommand,
    // Called without arguments: the running script and this file are where it looks from.
    { provide: RUNNER_ROOT, useFactory: findRunnerRoot },
    { provide: TESTS_HOOKS, useValue: NO_HOOKS },
  ],
  exports: [TestsService],
})
export class TestsModule {}
