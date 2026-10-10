import { Module } from '@nestjs/common';

import { SPAWN, type ProcessSpawner } from '@choliba/core';

import { ProcessRunnerService } from './process-runner.service';

/** `ProcessRunnerService` for the commands still on Nest. `terminal run` is built by `terminalShell`. */
@Module({
  providers: [
    {
      provide: ProcessRunnerService,
      useFactory: (spawner: ProcessSpawner) => new ProcessRunnerService({ spawner }),
      inject: [SPAWN],
    },
  ],
  exports: [ProcessRunnerService],
})
export class TerminalModule {}
