import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { CliHelpService, HelpRegistryService } from '../help/nest';
import { CliCommand } from './cli-command';
import { CommandIo } from './command-io.service';
import type { RootOptions } from './interfaces/root.interface';
import { ROOT_OPTIONS } from './root.constants';

/** `<app> __complete <words…>`: one suggestion per line for the last word, read by the bash completion script. */
@Command({ name: '__complete', options: { hidden: true }, allowUnknownOptions: true, allowExcessArgs: true })
export class CompleteCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(CliHelpService) private readonly help: CliHelpService,
    @Inject(HelpRegistryService) private readonly registry: HelpRegistryService,
    @Inject(ROOT_OPTIONS) private readonly options: RootOptions,
  ) {
    super();
  }

  run(): Promise<void> {
    const words = this.io.args('__complete');
    const delegated = this.options.delegateComplete?.(words);
    if (delegated !== undefined) {
      this.io.write(delegated);
      return Promise.resolve();
    }
    this.help.printCompletions(this.registry.spec(this.options.spec, this.options.groups), words);
    return Promise.resolve();
  }
}
