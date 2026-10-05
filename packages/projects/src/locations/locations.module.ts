import { Module } from '@nestjs/common';

import { ConfigModule } from '@choliba/core/nest';

import { LocationsService } from './locations.service';

@Module({
  imports: [ConfigModule],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
