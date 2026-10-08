import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/nest';
import { ThemeService } from './theme.service';

@Module({
  imports: [ConfigModule],
  providers: [ThemeService],
  exports: [ThemeService],
})
export class ThemeModule {}
