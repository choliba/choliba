import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '../config/nest';
import { ENV, NO_COLOR_FLAG, STDOUT, type Environment, type WritableWithColumns } from '../platform';
import { ThemeService } from './theme.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ThemeService,
      useFactory: (config: ConfigService, env: Environment, stdout: WritableWithColumns, noColorFlag: boolean) =>
        new ThemeService(config, env, stdout, noColorFlag),
      inject: [ConfigService, ENV, STDOUT, NO_COLOR_FLAG],
    },
  ],
  exports: [ThemeService],
})
export class ThemeModule {}
