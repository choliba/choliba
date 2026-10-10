import { Module } from '@nestjs/common';

import { CWD, ENV, type Environment } from '../platform';
import { ConfigService } from './config.service';

@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: (cwd: string, env: Environment) => new ConfigService(cwd, env),
      inject: [CWD, ENV],
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
