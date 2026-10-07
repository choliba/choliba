import { Module } from '@nestjs/common';

import { CliModule } from '@choliba/core/nest';

import { NewCommand } from './new.command';
import { NewService } from './new.service';

@Module({
  imports: [CliModule],
  providers: [NewCommand, NewService],
})
export class NewModule {}
