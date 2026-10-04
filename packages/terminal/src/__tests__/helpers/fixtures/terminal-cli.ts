// Runs `TerminalModule` the way choliba's main.ts runs the app, with the real Bun.spawn: for the
// integration spec, which runs this file in a real `bun` process.
import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';

import { ExitStatus, PlatformModule } from '@choliba/core/nest';
import { createSpawnGitRunner } from '@choliba/core/platform';

import { createBunProcessSpawner } from '../../../index';
import { TerminalModule } from '../../../nest';

@Module({})
class FixtureModule {}

const app = await CommandFactory.runWithoutClosing(
  {
    module: FixtureModule,
    imports: [
      PlatformModule.forRoot({
        argv: process.argv.slice(2),
        cwd: process.cwd(),
        env: process.env,
        stdout: process.stdout,
        stderr: process.stderr,
        clock: () => new Date(),
        signals: process,
        spawn: createBunProcessSpawner(Bun.spawn),
        which: (bin) => Bun.which(bin),
        git: createSpawnGitRunner(),
        noColorFlag: false,
      }),
      TerminalModule,
    ],
  },
  { logger: false },
);
process.exitCode = app.get(ExitStatus).code();
await app.close();
