import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliHelpService, HelpRegistryService } from '../help/nest';
import { CliCommand } from './cli-command';
import { CommandIo } from './command-io.service';
import type { RootOptions } from './interfaces/root.interface';
import { ROOT_OPTIONS } from './root.constants';

/** `<app> __describe <words…>`: one line on what the words select. */
@Command({ name: '__describe', options: { hidden: true }, allowUnknownOptions: true, allowExcessArgs: true })
export class DescribeCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(CliHelpService) private readonly help: CliHelpService,
    @Inject(HelpRegistryService) private readonly registry: HelpRegistryService,
    @Inject(ROOT_OPTIONS) private readonly options: RootOptions,
  ) {
    super();
  }

  run(): Promise<void> {
    this.help.printDescription(this.registry.spec(this.options.spec, this.options.groups), this.io.args('__describe'));
    return Promise.resolve();
  }
}
