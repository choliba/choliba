import { Module } from '@nestjs/common';

import { ThemeModule } from '@choliba/core/nest';
import { SPAWN, type ProcessSpawner } from '@choliba/core/platform';

import { ProcessRunnerService } from './process-runner.service';
import { TerminalCommand } from './terminal.command';
import { TerminalService } from './terminal.service';

@Module({
  imports: [ThemeModule],
  providers: [
    {
      provide: ProcessRunnerService,
      useFactory: (spawner: ProcessSpawner) => new ProcessRunnerService({ spawner }),
      inject: [SPAWN],
    },
    TerminalService,
    TerminalCommand,
  ],
  exports: [ProcessRunnerService],
})
export class TerminalModule {}
