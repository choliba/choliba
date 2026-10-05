import { Module } from '@nestjs/common';

import { CliModule, ConfigModule } from '@choliba/core/nest';

import { InstallCommand } from './install.command';
import { InstallService } from './install.service';

@Module({
  imports: [ConfigModule, CliModule],
  providers: [InstallService, InstallCommand],
})
export class InstallModule {}
