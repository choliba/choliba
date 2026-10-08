import { Module } from '@nestjs/common';

import { CliModule } from '@choliba/core/nest';

import { AddModule } from '../add/nest';
import { NewCommand } from './new.command';
import { NewService } from './new.service';

@Module({
  imports: [CliModule, AddModule],
  providers: [NewCommand, NewService],
})
export class NewModule {}
