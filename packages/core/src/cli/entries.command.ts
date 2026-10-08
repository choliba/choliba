import { Inject } from '@nestjs/common';
import { Command } from 'nest-commander';

import { HelpRegistryService } from '../help/nest';
import { CliCommand } from './cli-command';
import { CommandIo } from './command-io.service';
import type { RootOptions } from './interfaces/root.interface';
import { ROOT_OPTIONS } from './root.constants';

/**
 * `<app> __entries`: the commands `--help` lists, as JSON (`[{ name, description, group }]`), for another program to
 * show them (the machine's `choliba` lists the workspace's next to its own).
 */
@Command({ name: '__entries', options: { hidden: true }, allowUnknownOptions: true, allowExcessArgs: true })
export class EntriesCommand extends CliCommand {
  constructor(
    @Inject(CommandIo) private readonly io: CommandIo,
    @Inject(HelpRegistryService) private readonly registry: HelpRegistryService,
    @Inject(ROOT_OPTIONS) private readonly options: RootOptions,
  ) {
    super();
  }

  run(): Promise<void> {
    const entries = (this.registry.spec(this.options.spec, this.options.groups).commands?.() ?? [])
      .filter((entry) => entry.listed !== false)
      .map(({ name, description, group }) => ({ name, description, group }));
    this.io.write(`${JSON.stringify(entries)}\n`);
    return Promise.resolve();
  }
}
